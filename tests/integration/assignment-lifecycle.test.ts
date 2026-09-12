import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { createFixtureAccounts } from './fixtures'

describe('assignment offer lifecycle', () => {
  const pending = createFixtureAccounts()
  let fixture: Awaited<typeof pending>
  const database = new Client({ connectionString: process.env.LYSTO_TEST_DATABASE_URL })
  const requestIds: string[] = []
  const jobIds: string[] = []
  let categoryId: string
  let issueId: string
  const visit = new Date(Date.now() + 10 * 86_400_000)
  visit.setUTCHours(12, 0, 0, 0)

  async function createJob() {
    const requestId = randomUUID()
    const jobId = randomUUID()
    requestIds.push(requestId)
    jobIds.push(jobId)
    const address = await database.query(
      'select id from public.customer_addresses where customer_id=$1 limit 1',
      [fixture.accounts.customerA.entityId]
    )
    await database.query(
      `insert into public.service_requests(id,customer_id,address_id,category_id,issue_type_id,status,preferred_date,preferred_time_window)
       values($1,$2,$3,$4,$5,'pending_assignment',$6,'09:00-12:00')`,
      [
        requestId,
        fixture.accounts.customerA.entityId,
        address.rows[0].id,
        categoryId,
        issueId,
        visit.toISOString().slice(0, 10)
      ]
    )
    await database.query(
      `insert into public.jobs(id,request_id,customer_id,status,scheduled_date,scheduled_time_window)
       values($1,$2,$3,'pending_assignment',$4,'09:00-12:00')`,
      [jobId, requestId, fixture.accounts.customerA.entityId, visit.toISOString().slice(0, 10)]
    )
    return jobId
  }

  beforeAll(async () => {
    fixture = await pending
    await database.connect()
    const config = await database.query(
      `select c.id category_id,i.id issue_id from public.service_categories c
       join public.service_issue_types i on i.category_id=c.id where c.active and i.active limit 1`
    )
    categoryId = config.rows[0].category_id
    issueId = config.rows[0].issue_id
    const professional = fixture.accounts.professionalApproved.entityId
    await database.query(
      `insert into public.professional_service_categories(professional_id,category_id,approved) values($1,$2,true)`,
      [professional, categoryId]
    )
    await database.query(
      `insert into public.professional_service_zones(professional_id,zone_slug,zone_name) values($1,'caba','CABA')`,
      [professional]
    )
    await database.query(
      `insert into public.professional_tools(professional_id,tool_code,tool_label,has_tool)
       values($1,'fixture_tool','Herramienta verificada',true)`,
      [professional]
    )
    await database.query(
      `insert into public.professional_availability(professional_id,weekday,start_time,end_time)
       select $1,d,'00:00','23:59' from generate_series(0,6)d`,
      [professional]
    )
  })

  afterAll(async () => {
    try {
      await database.query('delete from public.jobs where id=any($1::uuid[])', [jobIds])
      await database.query('delete from public.service_requests where id=any($1::uuid[])', [
        requestIds
      ])
    } finally {
      await database.end()
      await pending.cleanup()
    }
  })

  it('filters suspended, specialty, zone and tool failures before presenting candidates', async () => {
    const jobId = await createJob()
    const result = await fixture.accounts.operations.client.rpc('list_assignment_candidates', {
      p_job_id: jobId,
      p_starts_at: visit.toISOString(),
      p_duration_minutes: 90,
      p_travel_buffer_minutes: 30
    })
    expect(result.error).toBeNull()
    expect(result.data.map((candidate: { id: string }) => candidate.id)).toEqual([
      fixture.accounts.professionalApproved.entityId
    ])
    expect(JSON.stringify(result.data)).not.toContain(
      fixture.accounts.professionalSuspended.entityId
    )
    await database.query(
      'update public.professional_tools set has_tool=false where professional_id=$1',
      [fixture.accounts.professionalApproved.entityId]
    )
    const noTools = await fixture.accounts.operations.client.rpc('list_assignment_candidates', {
      p_job_id: jobId,
      p_starts_at: visit.toISOString(),
      p_duration_minutes: 90,
      p_travel_buffer_minutes: 30
    })
    expect(noTools.data).toEqual([])
    const rechecked = await fixture.accounts.operations.client.rpc('create_assignment_offer', {
      p_job_id: jobId,
      p_professional_id: fixture.accounts.professionalApproved.entityId,
      p_starts_at: visit.toISOString(),
      p_duration_minutes: 90,
      p_travel_buffer_minutes: 30,
      p_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      p_expected_version: 0
    })
    expect(rechecked.error?.code).toBe('22023')
    await database.query(
      'update public.professional_tools set has_tool=true where professional_id=$1',
      [fixture.accounts.professionalApproved.entityId]
    )
  })

  it('serializes two operators and makes repeated acceptance idempotent', async () => {
    const jobId = await createJob()
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString()
    const create = (actor: 'operations' | 'owner') =>
      fixture.accounts[actor].client.rpc('create_assignment_offer', {
        p_job_id: jobId,
        p_professional_id: fixture.accounts.professionalApproved.entityId,
        p_starts_at: new Date(visit.getTime() + 4 * 3_600_000).toISOString(),
        p_duration_minutes: 90,
        p_travel_buffer_minutes: 30,
        p_expires_at: expiresAt,
        p_expected_version: 0
      })
    const results = await Promise.all([create('operations'), create('owner')])
    expect(results.filter((result) => result.error === null)).toHaveLength(1)
    expect(results.filter((result) => result.error?.code === '40001')).toHaveLength(1)
    const offer = results.find((result) => result.data)?.data
    const accept = () =>
      fixture.accounts.professionalApproved.client.rpc('respond_assignment_offer', {
        p_offer_id: offer.id,
        p_response: 'accepted',
        p_reason: null,
        p_expected_version: offer.version
      })
    const first = await accept()
    const repeated = await accept()
    expect(first.data.status).toBe('accepted')
    expect(repeated.data).toEqual(first.data)
    expect(
      (
        await database.query(
          `select count(*)::integer count from public.assignment_offers where job_id=$1 and status='accepted'`,
          [jobId]
        )
      ).rows[0].count
    ).toBe(1)
    expect(first.data.paymentStatus).toBe('pending')
  })

  it('persists rejection reason and returns the job to the queue', async () => {
    const jobId = await createJob()
    const created = await fixture.accounts.operations.client.rpc('create_assignment_offer', {
      p_job_id: jobId,
      p_professional_id: fixture.accounts.professionalApproved.entityId,
      p_starts_at: new Date(visit.getTime() + 8 * 3_600_000).toISOString(),
      p_duration_minutes: 60,
      p_travel_buffer_minutes: 0,
      p_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      p_expected_version: 0
    })
    const rejected = await fixture.accounts.professionalApproved.client.rpc(
      'respond_assignment_offer',
      {
        p_offer_id: created.data.id,
        p_response: 'rejected',
        p_reason: 'No dispongo del repuesto requerido para esta visita.',
        p_expected_version: created.data.version
      }
    )
    expect(rejected.error).toBeNull()
    expect(
      (
        await database.query(
          `select o.status,o.rejection_reason,j.status job_status,j.professional_id
           from public.assignment_offers o join public.jobs j on j.id=o.job_id where o.id=$1`,
          [created.data.id]
        )
      ).rows[0]
    ).toMatchObject({
      status: 'rejected',
      rejection_reason: 'No dispongo del repuesto requerido para esta visita.',
      job_status: 'pending_assignment',
      professional_id: null
    })
  })

  it('expires an unanswered proposal once and rejects late acceptance', async () => {
    const jobId = await createJob()
    const created = await fixture.accounts.operations.client.rpc('create_assignment_offer', {
      p_job_id: jobId,
      p_professional_id: fixture.accounts.professionalApproved.entityId,
      p_starts_at: new Date(visit.getTime() + 11 * 3_600_000).toISOString(),
      p_duration_minutes: 60,
      p_travel_buffer_minutes: 0,
      p_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      p_expected_version: 0
    })
    await database.query(
      `update public.assignment_offers set expires_at=clock_timestamp()-interval '1 minute' where id=$1`,
      [created.data.id]
    )
    const late = await fixture.accounts.professionalApproved.client.rpc(
      'respond_assignment_offer',
      {
        p_offer_id: created.data.id,
        p_response: 'accepted',
        p_reason: null,
        p_expected_version: created.data.version
      }
    )
    expect(late.error).toBeNull()
    expect(late.data.status).toBe('expired')
    expect(
      (await fixture.accounts.operations.client.rpc('expire_assignment_offers', { p_limit: 50 }))
        .data
    ).toBe(0)
    expect(
      (
        await database.query(
          `select count(*)::integer count from public.notifications
           where entity_id=$1 and event_type='job.assignment_expired'`,
          [jobId]
        )
      ).rows[0].count
    ).toBeGreaterThanOrEqual(2)
  })
})
