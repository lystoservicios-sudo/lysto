import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { createFixtureAccounts } from './fixtures'

describe('support and warranty operations', () => {
  const setup = createFixtureAccounts(),
    db = new Client({ connectionString: process.env.LYSTO_TEST_DATABASE_URL })
  let fixture: Awaited<typeof setup>
  const equipmentId = randomUUID(),
    requestId = randomUUID(),
    jobId = randomUUID(),
    reportId = randomUUID()
  const caseIds: string[] = [],
    revisitJobs: string[] = [],
    revisitRequests: string[] = []
  beforeAll(async () => {
    fixture = await setup
    await db.connect()
    const config = (
      await db.query(
        `select c.id category,i.id issue from public.service_categories c join public.service_issue_types i on i.category_id=c.id where c.active and i.active limit 1`
      )
    ).rows[0]
    await db.query(
      `insert into public.customer_equipment(id,customer_id,nickname,equipment_type) values($1,$2,'Equipo garantía','split')`,
      [equipmentId, fixture.accounts.customerA.entityId]
    )
    await db.query(
      `insert into public.service_requests(id,customer_id,category_id,issue_type_id,status,equipment_id) values($1,$2,$3,$4,'assigned',$5)`,
      [requestId, fixture.accounts.customerA.entityId, config.category, config.issue, equipmentId]
    )
    await db.query(
      `insert into public.jobs(id,request_id,customer_id,professional_id,status,completed_at,warranty_until) values($1,$2,$3,$4,'completed',now(),current_date)`,
      [
        jobId,
        requestId,
        fixture.accounts.customerA.entityId,
        fixture.accounts.professionalApproved.entityId
      ]
    )
    await db.query(
      `insert into public.job_final_reports(id,job_id,equipment_id,real_diagnosis,work_done,final_state,warranty_days,after_photo_ids,submission_fingerprint) values($1,$2,$3,'Diagnóstico confirmado','Reparación verificada','resolved',30,array[$4]::uuid[],$5)`,
      [reportId, jobId, equipmentId, randomUUID(), 'd'.repeat(64)]
    )
  })
  afterAll(async () => {
    try {
      const links = await db.query(
        `select revisit_job_id from public.warranty_claims where job_id=$1 and revisit_job_id is not null`,
        [jobId]
      )
      for (const row of links.rows) {
        revisitJobs.push(row.revisit_job_id)
        const r = await db.query(`select request_id from public.jobs where id=$1`, [
          row.revisit_job_id
        ])
        if (r.rows[0]) revisitRequests.push(r.rows[0].request_id)
      }
      await db.query(`delete from private.outbox_events where aggregate_id=any($1::uuid[])`, [
        caseIds
      ])
      await db.query(`delete from public.warranty_claims where job_id=$1`, [jobId])
      await db.query(`delete from public.complaints where job_id=$1`, [jobId])
      if (revisitJobs.length)
        await db.query(`delete from public.jobs where id=any($1::uuid[])`, [revisitJobs])
      if (revisitRequests.length)
        await db.query(`delete from public.service_requests where id=any($1::uuid[])`, [
          revisitRequests
        ])
      await db.query(`delete from public.job_final_reports where id=$1`, [reportId])
      await db.query(`delete from public.jobs where id=$1`, [jobId])
      await db.query(`delete from public.service_requests where id=$1`, [requestId])
      await db.query(`delete from public.customer_equipment where id=$1`, [equipmentId])
    } finally {
      await db.end()
      await setup.cleanup()
    }
  })
  it('derives participants, rejects a foreign customer and replays one command', async () => {
    const key = randomUUID(),
      args = {
        p_job_id: jobId,
        p_category: 'quality',
        p_description: 'El resultado necesita una revisión técnica adicional.',
        p_has_safety_risk: false,
        p_payment_blocked: false,
        p_customer_waiting: false,
        p_evidence_ids: [],
        p_idempotency_key: key
      }
    expect(
      (await fixture.accounts.customerB.client.rpc('open_support_case', args)).error?.code
    ).toBe('P0002')
    const first = await fixture.accounts.customerA.client.rpc('open_support_case', args),
      repeat = await fixture.accounts.customerA.client.rpc('open_support_case', args)
    expect(first.error).toBeNull()
    expect(repeat.data).toEqual(first.data)
    caseIds.push(first.data.id)
  })
  it('keeps internal notes out of participant timelines', async () => {
    const current = (
      await fixture.accounts.quality.client.rpc('list_support_cases', { p_limit: 100 })
    ).data.find((c: { id: string }) => c.id === caseIds[0])
    const updated = await fixture.accounts.quality.client.rpc('update_support_case', {
      p_case_id: current.id,
      p_action: 'start_review',
      p_expected_version: current.version,
      p_public_message: 'Estamos revisando el antecedente técnico.',
      p_internal_note: 'Validar evidencia antes de contactar al profesional.',
      p_assigned_to: null,
      p_evidence_ids: [],
      p_resolution_reason: null,
      p_communication_failed: false
    })
    expect(updated.error).toBeNull()
    const customer = (
        await fixture.accounts.customerA.client.rpc('list_support_cases', { p_limit: 100 })
      ).data.find((c: { id: string }) => c.id === current.id),
      quality = (
        await fixture.accounts.quality.client.rpc('list_support_cases', { p_limit: 100 })
      ).data.find((c: { id: string }) => c.id === current.id)
    expect(customer.events.at(-1).internalNote).toBeNull()
    expect(quality.events.at(-1).internalNote).toContain('Validar evidencia')
  })
  it('accepts the final coverage day, rejects duplicate active claims and creates a no-charge revisit', async () => {
    const claim = await fixture.accounts.customerA.client.rpc('open_warranty_claim', {
      p_job_id: jobId,
      p_description: 'El mismo problema reapareció durante el último día cubierto.',
      p_same_problem: true,
      p_evidence_ids: [],
      p_idempotency_key: randomUUID()
    })
    expect(claim.error).toBeNull()
    expect(claim.data.coverageEligible).toBe(true)
    caseIds.push(claim.data.caseId)
    expect(
      (
        await fixture.accounts.customerA.client.rpc('open_warranty_claim', {
          p_job_id: jobId,
          p_description: 'Intento duplicado para el mismo trabajo todavía abierto.',
          p_same_problem: true,
          p_evidence_ids: [],
          p_idempotency_key: randomUUID()
        })
      ).error?.code
    ).toBe('40001')
    const decision = await fixture.accounts.quality.client.rpc('decide_warranty_claim', {
      p_claim_id: claim.data.id,
      p_decision: 'approve',
      p_expected_version: 1,
      p_reason: 'Cobertura confirmada; corresponde una revisita técnica sin cargo.'
    })
    expect(decision.error).toBeNull()
    expect(decision.data.billingPolicy).toBe('warranty_no_charge')
    const revisit = (
      await db.query(
        `select warranty_revisit_of_job_id,billing_policy,final_amount from public.jobs where id=$1`,
        [decision.data.revisitJobId]
      )
    ).rows[0]
    expect(revisit).toMatchObject({
      warranty_revisit_of_job_id: jobId,
      billing_policy: 'warranty_no_charge',
      final_amount: '0.00'
    })
  })
})
