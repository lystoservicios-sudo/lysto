import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { createFixtureAccounts } from './fixtures'

describe('atomic job closeout', () => {
  const setup = createFixtureAccounts()
  let fixture: Awaited<typeof setup>
  const db = new Client({ connectionString: process.env.LYSTO_TEST_DATABASE_URL })
  const requestId = randomUUID(),
    jobId = randomUUID(),
    equipmentId = randomUUID(),
    photoId = randomUUID(),
    extraId = randomUUID(),
    path = `fixture/${jobId}/after/${photoId}.webp`,
    hash = 'a'.repeat(64)
  const input = (
    key = randomUUID(),
    work = 'Se reemplazó capacitor y se verificó el arranque completo.'
  ) => ({
    p_job_id: jobId,
    p_equipment_id: equipmentId,
    p_real_diagnosis: 'Capacitor fuera de tolerancia confirmado con medición.',
    p_work_done: work,
    p_parts_used: null,
    p_final_state: 'resolved',
    p_maintenance_option: 'none' as const,
    p_next_maintenance_date: null,
    p_warranty_days: 30,
    p_internal_notes: null,
    p_after_photo_ids: [photoId],
    p_idempotency_key: key
  })
  beforeAll(async () => {
    fixture = await setup
    await db.connect()
    const config = await db.query(
      `select c.id category,i.id issue from public.service_categories c join public.service_issue_types i on i.category_id=c.id where c.active and i.active limit 1`
    )
    await db.query(
      `insert into public.customer_equipment(id,customer_id,nickname,equipment_type) values($1,$2,'Equipo cierre','split')`,
      [equipmentId, fixture.accounts.customerA.entityId]
    )
    await db.query(
      `insert into public.service_requests(id,customer_id,category_id,issue_type_id,status,equipment_id) values($1,$2,$3,$4,'assigned',$5)`,
      [
        requestId,
        fixture.accounts.customerA.entityId,
        config.rows[0].category,
        config.rows[0].issue,
        equipmentId
      ]
    )
    await db.query(
      `insert into public.jobs(id,request_id,customer_id,professional_id,status,started_at) values($1,$2,$3,$4,'in_progress',now())`,
      [
        jobId,
        requestId,
        fixture.accounts.customerA.entityId,
        fixture.accounts.professionalApproved.entityId
      ]
    )
    await db.query(
      `insert into public.onsite_diagnoses(job_id,professional_id,equipment_id,actual_diagnosis,base_scope,evidence_ids,status,submitted_by,decided_by,decided_at) values($1,$2,$3,'Capacitor fuera de tolerancia confirmado con medición.','Reemplazo y prueba completa del arranque.',array[$4]::uuid[],'accepted',$5,$6,now())`,
      [
        jobId,
        fixture.accounts.professionalApproved.entityId,
        equipmentId,
        photoId,
        fixture.accounts.professionalApproved.profileId,
        fixture.accounts.customerA.profileId
      ]
    )
    await db.query(
      `insert into private.upload_intents(id,owner_profile_id,owner_auth_user_id,kind,entity_id,mime_type,size_bytes,sha256,phase,quarantine_path,output_bucket,output_path,output_mime_type,output_size_bytes,output_sha256,status,attachment_id,verified_at) values($1,$2,$3,'job-photo',$4,'image/webp',4,$5,'after',$6,'job-evidence',$7,'image/webp',4,$5,'verified',$1,now())`,
      [
        photoId,
        fixture.accounts.professionalApproved.profileId,
        fixture.accounts.professionalApproved.authId,
        jobId,
        hash,
        `quarantine/${photoId}`,
        path
      ]
    )
    await db.query(
      `insert into public.job_media(id,job_id,media_type,phase,storage_bucket,storage_path,uploaded_by) values($1,$2,'photo','after','job-evidence',$3,$4)`,
      [photoId, jobId, path, fixture.accounts.professionalApproved.profileId]
    )
  })
  afterAll(async () => {
    try {
      await db.query('delete from private.job_closeout_commands where job_id=$1', [jobId])
      await db.query('delete from public.job_closeout_followups where job_id=$1', [jobId])
      await db.query('delete from public.receipts where job_id=$1', [jobId])
      await db.query('delete from public.equipment_service_records where job_id=$1', [jobId])
      await db.query('delete from public.job_final_reports where job_id=$1', [jobId])
      await db.query('delete from public.job_extras where id=$1', [extraId])
      await db.query('delete from public.onsite_diagnoses where job_id=$1', [jobId])
      await db.query('delete from public.job_media where id=$1', [photoId])
      await db.query('delete from private.upload_intents where id=$1', [photoId])
      await db.query('delete from public.jobs where id=$1', [jobId])
      await db.query('delete from public.service_requests where id=$1', [requestId])
      await db.query('delete from public.customer_equipment where id=$1', [equipmentId])
    } finally {
      await db.end()
      await setup.cleanup()
    }
  })
  it('rejects unverified evidence and leaves no partial closeout', async () => {
    await db.query(
      `update private.upload_intents set status='pending',attachment_id=null,verified_at=null,output_size_bytes=null,output_sha256=null where id=$1`,
      [photoId]
    )
    const rejected = await fixture.accounts.professionalApproved.client.rpc(
      'close_job_with_final_report',
      input()
    )
    expect(rejected.error?.code).toBe('22023')
    const counts = await db.query(
      `select (select count(*) from public.job_final_reports where job_id=$1) reports,(select count(*) from public.equipment_service_records where job_id=$1) records,(select count(*) from public.receipts where job_id=$1) receipts`,
      [jobId]
    )
    expect(counts.rows[0]).toMatchObject({ reports: '0', records: '0', receipts: '0' })
    await db.query(
      `update private.upload_intents set status='verified',attachment_id=id,verified_at=now(),output_size_bytes=4,output_sha256=$2 where id=$1`,
      [photoId, hash]
    )
  })
  it('rejects foreign equipment, invalid state and a pending extra', async () => {
    expect(
      (
        await fixture.accounts.professionalApproved.client.rpc('close_job_with_final_report', {
          ...input(),
          p_equipment_id: randomUUID()
        })
      ).error?.code
    ).toBe('42501')
    expect(
      (
        await fixture.accounts.professionalApproved.client.rpc('close_job_with_final_report', {
          ...input(),
          p_final_state: 'invented'
        })
      ).error?.code
    ).toBe('22023')
    await db.query(
      `insert into public.job_extras(id,job_id,professional_id,fault,description,amount,idempotency_key) values($1,$2,$3,'Falla adicional','Trabajo adicional todavía sin decisión',100,$4)`,
      [extraId, jobId, fixture.accounts.professionalApproved.entityId, randomUUID()]
    )
    expect(
      (
        await fixture.accounts.professionalApproved.client.rpc(
          'close_job_with_final_report',
          input()
        )
      ).error?.code
    ).toBe('40001')
    await db.query(
      `update public.job_extras set status='rejected',decided_by=$2,decided_at=now() where id=$1`,
      [extraId, fixture.accounts.customerA.profileId]
    )
  })
  it('writes report, history, receipt and status once and replays safely', async () => {
    const key = randomUUID(),
      first = await fixture.accounts.professionalApproved.client.rpc(
        'close_job_with_final_report',
        input(key)
      ),
      repeat = await fixture.accounts.professionalApproved.client.rpc(
        'close_job_with_final_report',
        input(key)
      ),
      newKey = await fixture.accounts.professionalApproved.client.rpc(
        'close_job_with_final_report',
        input()
      )
    expect(first.error).toBeNull()
    expect(repeat.data).toEqual(first.data)
    expect(newKey.data).toMatchObject({ idempotent: true })
    expect(
      (
        await fixture.accounts.professionalApproved.client.rpc(
          'close_job_with_final_report',
          input(randomUUID(), 'Contenido distinto que exige revisión y nunca sobrescribe.')
        )
      ).error?.code
    ).toBe('40001')
    const state = await db.query(
      `select j.status,(select count(*) from public.job_final_reports where job_id=j.id) reports,(select count(*) from public.equipment_service_records where job_id=j.id) records,(select count(*) from public.receipts where job_id=j.id) receipts from public.jobs j where j.id=$1`,
      [jobId]
    )
    expect(state.rows[0]).toMatchObject({
      status: 'completed_pending_customer_confirmation',
      reports: '1',
      records: '1',
      receipts: '1'
    })
  })
})
