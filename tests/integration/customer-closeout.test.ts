import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { createFixtureAccounts } from './fixtures'

describe('customer confirmation and optional review', () => {
  const setup = createFixtureAccounts()
  let fixture: Awaited<typeof setup>
  const db = new Client({ connectionString: process.env.LYSTO_TEST_DATABASE_URL })
  const equipmentId = randomUUID(),
    requestIds = [randomUUID(), randomUUID(), randomUUID()],
    jobIds = [randomUUID(), randomUUID(), randomUUID()],
    reportIds = [randomUUID(), randomUUID()]
  beforeAll(async () => {
    fixture = await setup
    await db.connect()
    const config = (
      await db.query(
        `select c.id category,i.id issue from public.service_categories c join public.service_issue_types i on i.category_id=c.id where c.active and i.active limit 1`
      )
    ).rows[0]
    await db.query(
      `insert into public.customer_equipment(id,customer_id,nickname,equipment_type) values($1,$2,'Equipo conformidad','split')`,
      [equipmentId, fixture.accounts.customerA.entityId]
    )
    for (let index = 0; index < 3; index++) {
      await db.query(
        `insert into public.service_requests(id,customer_id,category_id,issue_type_id,status,equipment_id) values($1,$2,$3,$4,'assigned',$5)`,
        [
          requestIds[index],
          fixture.accounts.customerA.entityId,
          config.category,
          config.issue,
          equipmentId
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
  })
})
