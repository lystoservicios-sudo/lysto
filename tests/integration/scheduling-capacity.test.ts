import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { createFixtureAccounts } from './fixtures'

describe('transactional scheduling capacity', () => {
  const pending = createFixtureAccounts()
  let fixture: Awaited<typeof pending>
  const database = new Client({ connectionString: process.env.LYSTO_TEST_DATABASE_URL })
  const requestIds: string[] = []
  const jobIds: string[] = []
  const start = new Date(Date.now() + 7 * 86_400_000)
  start.setUTCHours(12, 0, 0, 0)
  const startsAt = start.toISOString()

  beforeAll(async () => {
    fixture = await pending
    await database.connect()
    await database.query(
      `insert into public.professional_availability(professional_id,weekday,start_time,end_time)
       select $1,d,'00:00','23:59' from generate_series(0,6) d on conflict do nothing`,
      [fixture.accounts.professionalApproved.entityId]
    )
    const config = await database.query(
      `select c.id category_id,i.id issue_id from public.service_categories c
       join public.service_issue_types i on i.category_id=c.id where c.active and i.active limit 1`
    )
    for (const professional of [
      fixture.accounts.professionalApproved.entityId,
      fixture.accounts.professionalApproved.entityId,
      fixture.accounts.professionalSuspended.entityId
    ]) {
      const requestId = randomUUID()
      const jobId = randomUUID()
      requestIds.push(requestId)
      jobIds.push(jobId)
      await database.query(
        `insert into public.service_requests(id,customer_id,category_id,issue_type_id,status)
         values($1,$2,$3,$4,'assigned')`,
        [
          requestId,
          fixture.accounts.customerA.entityId,
          config.rows[0].category_id,
          config.rows[0].issue_id
        ]
      )
      await database.query(
        `insert into public.jobs(id,request_id,customer_id,professional_id,status)
         values($1,$2,$3,$4,'confirmed')`,
        [jobId, requestId, fixture.accounts.customerA.entityId, professional]
      )
    }
  })

  afterAll(async () => {
    try {
      await database.query('delete from public.jobs where id=any($1::uuid[])', [jobIds])
      await database.query('delete from public.service_requests where id=any($1::uuid[])', [
        requestIds
      ])
      await database.query(
        'delete from public.professional_availability where professional_id=$1',
        [fixture.accounts.professionalApproved.entityId]
      )
    } finally {
      await database.end()
      await pending.cleanup()
    }
  })

  it('allows only one of two concurrent reservations for the same professional and interval', async () => {
    const reserve = (jobId: string) =>
      fixture.accounts.operations.client.rpc('reserve_job_schedule', {
        p_job_id: jobId,
        p_starts_at: startsAt,
        p_duration_minutes: 60,
        p_travel_buffer_minutes: 30,
        p_state: 'confirmed',
        p_hold_minutes: 0,
        p_expected_version: 0
      })
    const results = await Promise.all([reserve(jobIds[0]), reserve(jobIds[1])])
    expect(results.filter((result) => result.error === null)).toHaveLength(1)
    expect(results.filter((result) => result.error?.code === '40001')).toHaveLength(1)
  })

  it('rejects a suspended professional before consuming capacity', async () => {
    const result = await fixture.accounts.operations.client.rpc('reserve_job_schedule', {
      p_job_id: jobIds[2],
      p_starts_at: new Date(start.getTime() + 4 * 3_600_000).toISOString(),
      p_duration_minutes: 60,
      p_travel_buffer_minutes: 30,
      p_state: 'confirmed',
      p_hold_minutes: 0,
      p_expected_version: 0
    })
    expect(result.error?.code).toBe('22023')
  })

  it('serializes simultaneous approval and preserves economic fields', async () => {
    const scheduled = await database.query(
      `select job_id,version from public.job_schedule_reservations
       where job_id=any($1::uuid[]) and state='confirmed'`,
      [jobIds.slice(0, 2)]
    )
    const jobId = scheduled.rows[0].job_id as string
    const before = await database.query(
      'select final_amount,request_id from public.jobs where id=$1',
      [jobId]
    )
    const proposed = new Date(start.getTime() + 86_400_000).toISOString()
    const request = await fixture.accounts.customerA.client.rpc('request_job_reschedule', {
      p_job_id: jobId,
      p_starts_at: proposed,
      p_duration_minutes: 90,
      p_travel_buffer_minutes: 30,
      p_reason: 'La persona responsable no puede recibir al profesional en el horario original.',
      p_expected_version: scheduled.rows[0].version
    })
    expect(request.error).toBeNull()
    const approve = () =>
      fixture.accounts.professionalApproved.client.rpc('respond_job_reschedule', {
        p_request_id: request.data.id,
        p_decision: 'approve',
        p_expected_version: scheduled.rows[0].version
      })
    const approvals = await Promise.all([approve(), approve()])
    expect(approvals.filter((result) => result.data?.status === 'approved')).toHaveLength(1)
    expect(approvals.filter((result) => result.error?.code === '40001')).toHaveLength(1)
    const after = await database.query(
      'select final_amount,request_id,schedule_version from public.jobs where id=$1',
      [jobId]
    )
    expect(after.rows[0].final_amount).toBe(before.rows[0].final_amount)
    expect(after.rows[0].request_id).toBe(before.rows[0].request_id)
    expect(after.rows[0].schedule_version).toBe(scheduled.rows[0].version + 1)
  })

  it('returns the complete requested range and rejects oversized ranges', async () => {
    const ok = await fixture.accounts.professionalApproved.client.rpc('get_schedule_availability', {
      p_professional_id: fixture.accounts.professionalApproved.entityId,
      p_from: start.toISOString().slice(0, 10),
      p_to: new Date(start.getTime() + 10 * 86_400_000).toISOString().slice(0, 10)
    })
    expect(ok.error).toBeNull()
    expect(ok.data.reservations.length).toBeGreaterThan(0)
    const tooLarge = await fixture.accounts.professionalApproved.client.rpc(
      'get_schedule_availability',
      {
        p_professional_id: fixture.accounts.professionalApproved.entityId,
        p_from: start.toISOString().slice(0, 10),
        p_to: new Date(start.getTime() + 40 * 86_400_000).toISOString().slice(0, 10)
      }
    )
    expect(tooLarge.error?.code).toBe('22023')
  })

  it('expires holds idempotently and releases capacity after cancellation', async () => {
    const unused = await database.query(
      `select id,schedule_version from public.jobs where id=any($1::uuid[])
       and not exists(select 1 from public.job_schedule_reservations r where r.job_id=jobs.id and r.state in('hold','confirmed')) limit 1`,
      [jobIds.slice(0, 2)]
    )
    const hold = await fixture.accounts.operations.client.rpc('reserve_job_schedule', {
      p_job_id: unused.rows[0].id,
      p_starts_at: new Date(start.getTime() + 6 * 3_600_000).toISOString(),
      p_duration_minutes: 60,
      p_travel_buffer_minutes: 0,
      p_state: 'hold',
      p_hold_minutes: 5,
      p_expected_version: unused.rows[0].schedule_version
    })
    expect(hold.error).toBeNull()
    await database.query(
      `update public.job_schedule_reservations set hold_expires_at=clock_timestamp()-interval '1 minute'
       where id=$1`,
      [hold.data.id]
    )
    const expired = await fixture.accounts.operations.client.rpc('expire_schedule_holds')
    expect(expired.error).toBeNull()
    expect(expired.data).toBeGreaterThanOrEqual(1)
    expect((await fixture.accounts.operations.client.rpc('expire_schedule_holds')).data).toBe(0)

    const active = await database.query(
      `select job_id from public.job_schedule_reservations where job_id=any($1::uuid[]) and state='confirmed' limit 1`,
      [jobIds.slice(0, 2)]
    )
    await database.query(`update public.jobs set status='cancelled_by_customer' where id=$1`, [
      active.rows[0].job_id
    ])
    expect(
      (
        await database.query(
          `select count(*)::integer count from public.job_schedule_reservations where job_id=$1 and state in('hold','confirmed')`,
          [active.rows[0].job_id]
        )
      ).rows[0].count
    ).toBe(0)
  })
})
