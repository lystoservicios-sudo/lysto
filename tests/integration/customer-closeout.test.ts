import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { createFixtureAccounts } from './fixtures'

describe('customer confirmation and optional review', () => {
  const setup = createFixtureAccounts()
  let fixture: Awaited<typeof setup>
  const db = new Client({ connectionString: process.env.LYSTO_TEST_DATABASE_URL })
  const equipmentId = randomUUID(),
    requestIds = [randomUUID(), randomUUID(), randomUUID()],
    jobIds = [randomUUID(), randomUUID(), randomUUID()],
    reportIds = [randomUUID(), randomUUID()]
  let reviewClaim: { id: string; claim_token: string } | undefined
  beforeAll(async () => {
    fixture = await setup
    await db.connect()
    const config = (
      await db.query(
        `select c.id category,i.id issue from public.service_categories c join public.service_issue_types i on i.category_id=c.id where c.active and i.active limit 1`
      )
    ).rows[0]
    const addressId = (
      await db.query('select id from public.customer_addresses where customer_id=$1 limit 1', [
        fixture.accounts.customerA.entityId
      ])
    ).rows[0].id
    await db.query(
      `insert into public.customer_equipment(id,customer_id,address_id,category_id,nickname,equipment_type) values($1,$2,$3,$4,'Equipo conformidad','split')`,
      [equipmentId, fixture.accounts.customerA.entityId, addressId, config.category]
    )
    for (let index = 0; index < 3; index++) {
      await db.query(
        `insert into public.service_requests(id,customer_id,category_id,issue_type_id,status,equipment_id,address_id) values($1,$2,$3,$4,'assigned',$5,$6)`,
        [
          requestIds[index],
          fixture.accounts.customerA.entityId,
          config.category,
          config.issue,
          equipmentId,
          addressId
        ]
      )
      await db.query(
        `insert into public.jobs(id,request_id,customer_id,professional_id,status) values($1,$2,$3,$4,'completed_pending_customer_confirmation')`,
        [
          jobIds[index],
          requestIds[index],
          fixture.accounts.customerA.entityId,
          fixture.accounts.professionalApproved.entityId
        ]
      )
    }
    for (let index = 0; index < 2; index++)
      await db.query(
        `insert into public.job_final_reports(id,job_id,equipment_id,real_diagnosis,work_done,final_state,maintenance_option,warranty_days,after_photo_ids,submission_fingerprint) values($1,$2,$3,'Diagnóstico final verificado','Trabajo técnico finalizado','resolved','none',30,array[$4]::uuid[],$5)`,
        [reportIds[index], jobIds[index], equipmentId, randomUUID(), 'b'.repeat(64)]
      )
  })
  afterAll(async () => {
    try {
      await db.query('delete from public.complaints where job_id=any($1::uuid[])', [jobIds])
      await db.query('delete from public.reviews where job_id=any($1::uuid[])', [jobIds])
      await db.query('delete from public.job_customer_decisions where job_id=any($1::uuid[])', [
        jobIds
      ])
      await db.query('delete from public.job_final_reports where job_id=any($1::uuid[])', [jobIds])
      await db.query('delete from public.jobs where id=any($1::uuid[])', [jobIds])
      await db.query('delete from public.service_requests where id=any($1::uuid[])', [requestIds])
      await db.query('delete from public.customer_equipment where id=$1', [equipmentId])
    } finally {
      await db.end()
      await setup.cleanup()
    }
  })
  it('rejects another owner and confirmation without a final report', async () => {
    const foreign = await fixture.accounts.customerB.client.rpc('confirm_job_outcome', {
      p_job_id: jobIds[0],
      p_decision: 'confirmed',
      p_reason: null,
      p_idempotency_key: randomUUID()
    })
    expect(foreign.error?.code).toBe('P0002')
    const missing = await fixture.accounts.customerA.client.rpc('confirm_job_outcome', {
      p_job_id: jobIds[2],
      p_decision: 'confirmed',
      p_reason: null,
      p_idempotency_key: randomUUID()
    })
    expect(missing.error?.code).toBe('40001')
  })
  it('handles two confirmation tabs once without requiring a review', async () => {
    const requests = await Promise.all(
      [randomUUID(), randomUUID()].map((key) =>
        fixture.accounts.customerA.client.rpc('confirm_job_outcome', {
          p_job_id: jobIds[0],
          p_decision: 'confirmed',
          p_reason: null,
          p_idempotency_key: key
        })
      )
    )
    expect(requests.every((item) => !item.error)).toBe(true)
    expect(requests.map((item) => item.data.idempotent).sort()).toEqual([false, true])
    expect(
      (await db.query('select status from public.jobs where id=$1', [jobIds[0]])).rows[0].status
    ).toBe('completed')
    expect(
      (await db.query('select count(*) from public.reviews where job_id=$1', [jobIds[0]])).rows[0]
        .count
    ).toBe('0')
    const reminders = await db.query(
      `select id,available_at,
        available_at between clock_timestamp()+interval '119 minutes' and clock_timestamp()+interval '121 minutes' due_in_two_hours
       from private.outbox_events
       where aggregate_id=$1 and event_type='review.requested'`,
      [jobIds[0]]
    )
    expect(reminders.rows).toHaveLength(1)
    expect(reminders.rows[0].due_in_two_hours).toBe(true)
    const early = await db.query(
      `select * from public.claim_outbox_events($1,100,120,array['email'])`,
      [`${fixture.runId}-review-early`]
    )
    expect(early.rows.some((row) => row.id === reminders.rows[0].id)).toBe(false)

    await db.query(
      `update private.outbox_events set available_at=clock_timestamp()-interval '1 minute'
       where id=$1`,
      [reminders.rows[0].id]
    )
    const due = await db.query(
      `select * from public.claim_outbox_events($1,100,120,array['email'])`,
      [`${fixture.runId}-review-due`]
    )
    reviewClaim = due.rows.find((row) => row.id === reminders.rows[0].id)
    expect(reviewClaim).toBeTruthy()
  })
  it('submits one optional review without changing completion or job counts', async () => {
    const payload = {
        p_job_id: jobIds[0],
        p_service_rating: 2,
        p_professional_rating: 2,
        p_problem_resolved: false,
        p_would_hire_again: false,
        p_comment: 'El problema necesita seguimiento de calidad.',
        p_idempotency_key: randomUUID()
      },
      first = await fixture.accounts.customerA.client.rpc(
        'submit_customer_review_transaction',
        payload
      ),
      repeat = await fixture.accounts.customerA.client.rpc('submit_customer_review_transaction', {
        ...payload,
        p_idempotency_key: randomUUID()
      })
    expect(first.error).toBeNull()
    expect(repeat.data).toMatchObject({ idempotent: true })
    expect(
      (
        await fixture.accounts.customerA.client.rpc('submit_customer_review_transaction', {
          ...payload,
          p_comment: 'Contenido diferente que no debe sobrescribir.',
          p_idempotency_key: randomUUID()
        })
      ).error?.code
    ).toBe('40001')
    const metrics = (
      await db.query(
        `select p.jobs_completed,p.rating_avg,(select count(*)::int from public.jobs j where j.professional_id=p.id and j.status='completed') actual_completed,(select count(*)::int from public.complaints where job_id=$2 and source='review_quality') quality_cases from public.professional_profiles p where p.id=$1`,
        [fixture.accounts.professionalApproved.entityId, jobIds[0]]
      )
    ).rows[0]
    expect(metrics.jobs_completed).toBe(metrics.actual_completed)
    expect(metrics.quality_cases).toBe(1)
    const staleReminder = await fixture.accounts.customerA.client.rpc('resolve_outbox_delivery', {
      p_event_id: reviewClaim!.id,
      p_claim_token: reviewClaim!.claim_token
    })
    expect(staleReminder.error?.code).toBe('42501')
    const service = createClient(
      process.env.LYSTO_TEST_SUPABASE_URL!,
      process.env.LYSTO_TEST_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    expect(
      (
        await service.rpc('resolve_outbox_delivery', {
          p_event_id: reviewClaim!.id,
          p_claim_token: reviewClaim!.claim_token
        })
      ).error?.code
    ).toBe('22023')
  })
  it('records disagreement once and keeps the service disputed', async () => {
    const payload = {
        p_job_id: jobIds[1],
        p_decision: 'disputed',
        p_reason: 'El equipo continúa con la misma falla informada.',
        p_idempotency_key: randomUUID()
      },
      first = await fixture.accounts.customerA.client.rpc('confirm_job_outcome', payload),
      repeat = await fixture.accounts.customerA.client.rpc('confirm_job_outcome', {
        ...payload,
        p_idempotency_key: randomUUID()
      })
    expect(first.data.status).toBe('disputed')
    expect(repeat.data.idempotent).toBe(true)
    const state = (
      await db.query(
        `select j.status,(select count(*)::int from public.complaints where job_id=j.id and source='customer_dispute') cases from public.jobs j where j.id=$1`,
        [jobIds[1]]
      )
    ).rows[0]
    expect(state).toMatchObject({ status: 'disputed', cases: 1 })
    expect(
      (
        await db.query(
          `select count(*)::int count from private.outbox_events
           where aggregate_id=$1 and event_type='review.requested'`,
          [jobIds[1]]
        )
      ).rows[0].count
    ).toBe(0)
  })
})
