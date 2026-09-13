import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import { createFixtureAccounts } from './fixtures'

describe('onsite workflow', () => {
  const pending = createFixtureAccounts()
  let fixture: Awaited<typeof pending>
  const db = new Client({ connectionString: process.env.LYSTO_TEST_DATABASE_URL })
  const requestId = randomUUID(),
    jobId = randomUUID(),
    unpaidRequest = randomUUID(),
    unpaidJob = randomUUID(),
    equipmentId = randomUUID(),
    evidenceId = randomUUID()
  const checkoutIds: string[] = [],
    extraIds: string[] = []
  const evidencePath = `fixture/${jobId}/during/${evidenceId}.webp`
  beforeAll(async () => {
    fixture = await pending
    await db.connect()
    const config = await db.query(
      `select c.id category,i.id issue from public.service_categories c join public.service_issue_types i on i.category_id=c.id where c.active and i.active limit 1`
    )
    const addressId = (
      await db.query('select id from public.customer_addresses where customer_id=$1 limit 1', [
        fixture.accounts.customerA.entityId
      ])
    ).rows[0].id
    await db.query(
      `insert into public.customer_equipment(id,customer_id,address_id,category_id,nickname,equipment_type) values($1,$2,$3,$4,'Equipo visita','split')`,
      [equipmentId, fixture.accounts.customerA.entityId, addressId, config.rows[0].category]
    )
    for (const [request, job] of [
      [requestId, jobId],
      [unpaidRequest, unpaidJob]
    ]) {
      await db.query(
        `insert into public.service_requests(id,customer_id,category_id,issue_type_id,status,equipment_id,address_id) values($1,$2,$3,$4,'assigned',$5,$6)`,
        [
          request,
          fixture.accounts.customerA.entityId,
          config.rows[0].category,
          config.rows[0].issue,
          equipmentId,
          addressId
        ]
      )
      await db.query(
        `insert into public.jobs(id,request_id,customer_id,professional_id,status) values($1,$2,$3,$4,'confirmed')`,
        [
          job,
          request,
          fixture.accounts.customerA.entityId,
          fixture.accounts.professionalApproved.entityId
        ]
      )
    }
    const checkout = randomUUID()
    checkoutIds.push(checkout)
    await db.query(
      `insert into public.marketplace_checkouts(id,job_id,customer_id,professional_id,seller_account_id,amount,marketplace_fee,live_mode,status) values($1,$2,$3,$4,'seller',100,18,false,'approved')`,
      [
        checkout,
        jobId,
        fixture.accounts.customerA.entityId,
        fixture.accounts.professionalApproved.entityId
      ]
    )
    const storage = createClient(
      process.env.LYSTO_TEST_SUPABASE_URL!,
      process.env.LYSTO_TEST_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const uploaded = await storage.storage
      .from('job-evidence')
      .upload(evidencePath, new Uint8Array([82, 73, 70, 70]), { contentType: 'image/webp' })
    if (uploaded.error) throw uploaded.error
    await db.query(
      `insert into public.job_media(id,job_id,media_type,phase,storage_bucket,storage_path,uploaded_by) values($1,$2,'photo','during','job-evidence',$3,$4)`,
      [evidenceId, jobId, evidencePath, fixture.accounts.professionalApproved.profileId]
    )
  })
  afterAll(async () => {
    try {
      await db.query('delete from private.onsite_commands where actor_profile_id=any($1::uuid[])', [
        [fixture.accounts.professionalApproved.profileId, fixture.accounts.customerA.profileId]
      ])
      await db.query('delete from public.marketplace_checkouts where id=any($1::uuid[])', [
        checkoutIds
      ])
      await db.query('delete from public.job_extras where id=any($1::uuid[])', [extraIds])
      await db.query('delete from public.onsite_diagnoses where job_id=$1', [jobId])
      await db.query('delete from public.job_media where id=$1', [evidenceId])
      await db.query('delete from public.jobs where id=any($1::uuid[])', [[jobId, unpaidJob]])
      await db.query('delete from public.service_requests where id=any($1::uuid[])', [
        [requestId, unpaidRequest]
      ])
      await db.query('delete from public.customer_equipment where id=$1', [equipmentId])
      const storage = createClient(
        process.env.LYSTO_TEST_SUPABASE_URL!,
        process.env.LYSTO_TEST_SERVICE_ROLE_KEY!
      )
      await storage.storage.from('job-evidence').remove([evidencePath])
    } finally {
      await db.end()
      await pending.cleanup()
    }
  })
  it('blocks another professional and an assigned professional without approved payment', async () => {
    const outsider = await fixture.accounts.professionalSuspended.client.rpc(
      'advance_service_job_v2',
      { p_job_id: jobId, p_expected_status: 'confirmed', p_idempotency_key: randomUUID() }
    )
    expect(outsider.error).not.toBeNull()
    const unpaid = await fixture.accounts.professionalApproved.client.rpc(
      'advance_service_job_v2',
      { p_job_id: unpaidJob, p_expected_status: 'confirmed', p_idempotency_key: randomUUID() }
    )
    expect(unpaid.error?.code).toBe('40001')
  })
  it('replays visit commands and persists a verified onsite diagnosis', async () => {
    for (const expected of ['confirmed', 'technician_on_way', 'arrived']) {
      const key = randomUUID()
      const first = await fixture.accounts.professionalApproved.client.rpc(
        'advance_service_job_v2',
        { p_job_id: jobId, p_expected_status: expected, p_idempotency_key: key }
      )
      const repeat = await fixture.accounts.professionalApproved.client.rpc(
        'advance_service_job_v2',
        { p_job_id: jobId, p_expected_status: expected, p_idempotency_key: key }
      )
      expect(first.error).toBeNull()
      expect(repeat.data).toEqual(first.data)
    }
    const key = randomUUID()
    const diagnosis = await fixture.accounts.professionalApproved.client.rpc(
      'submit_onsite_diagnosis',
      {
        p_job_id: jobId,
        p_expected_status: 'onsite_diagnosis',
        p_actual_diagnosis: 'Capacitor fuera de tolerancia confirmado con medición.',
        p_base_scope: 'Reemplazo del capacitor y verificación completa del arranque.',
        p_equipment_id: equipmentId,
        p_evidence_ids: [evidenceId],
        p_idempotency_key: key
      }
    )
    expect(diagnosis.error).toBeNull()
    const repeat = await fixture.accounts.professionalApproved.client.rpc(
      'submit_onsite_diagnosis',
      {
        p_job_id: jobId,
        p_expected_status: 'onsite_diagnosis',
        p_actual_diagnosis: 'Capacitor fuera de tolerancia confirmado con medición.',
        p_base_scope: 'Reemplazo del capacitor y verificación completa del arranque.',
        p_equipment_id: equipmentId,
        p_evidence_ids: [evidenceId],
        p_idempotency_key: key
      }
    )
    expect(repeat.data).toEqual(diagnosis.data)
  })
  it('keeps rejected extras separate and requires accepted extra payment before work', async () => {
    const propose = async (fault: string) =>
      fixture.accounts.professionalApproved.client.rpc('propose_job_extra', {
        p_job_id: jobId,
        p_fault: fault,
        p_description: 'Trabajo adicional separado del alcance base acordado.',
        p_amount: 25,
        p_idempotency_key: randomUUID()
      })
    const rejected = (await propose('Drenaje secundario obstruido')).data
    extraIds.push(rejected.id)
    const rejectKey = randomUUID()
    const first = await fixture.accounts.customerA.client.rpc('decide_job_extra_v2', {
      p_extra_id: rejected.id,
      p_decision: 'rejected',
      p_idempotency_key: rejectKey
    })
    const repeat = await fixture.accounts.customerA.client.rpc('decide_job_extra_v2', {
      p_extra_id: rejected.id,
      p_decision: 'rejected',
      p_idempotency_key: rejectKey
    })
    expect(repeat.data).toEqual(first.data)
    const accepted = (await propose('Cableado adicional deteriorado')).data
    extraIds.push(accepted.id)
    await fixture.accounts.customerA.client.rpc('decide_job_extra_v2', {
      p_extra_id: accepted.id,
      p_decision: 'accepted',
      p_idempotency_key: randomUUID()
    })
    const version = (
      await db.query('select version from public.onsite_diagnoses where job_id=$1', [jobId])
    ).rows[0].version
    const blocked = await fixture.accounts.customerA.client.rpc('decide_onsite_scope', {
      p_job_id: jobId,
      p_decision: 'accepted',
      p_reason: null,
      p_expected_version: version,
      p_idempotency_key: randomUUID()
    })
    expect(blocked.error?.code).toBe('40001')
    const checkout = randomUUID()
    checkoutIds.push(checkout)
    await db.query(
      `insert into public.marketplace_checkouts(id,job_id,extra_id,customer_id,professional_id,seller_account_id,amount,marketplace_fee,live_mode,status) values($1,$2,$3,$4,$5,'seller',25,0,false,'approved')`,
      [
        checkout,
        jobId,
        accepted.id,
        fixture.accounts.customerA.entityId,
        fixture.accounts.professionalApproved.entityId
      ]
    )
    const started = await fixture.accounts.customerA.client.rpc('decide_onsite_scope', {
      p_job_id: jobId,
      p_decision: 'accepted',
      p_reason: null,
      p_expected_version: version,
      p_idempotency_key: randomUUID()
    })
    expect(started.data.jobStatus).toBe('in_progress')
  })
})
