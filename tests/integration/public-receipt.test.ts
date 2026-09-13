import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { lookupPublicReceipt } from '@/lib/receipts/public-receipt-service'
import { createFixtureAccounts } from './fixtures'

describe('minimal public receipt', () => {
  const setup = createFixtureAccounts()
  let fixture: Awaited<typeof setup>
  const db = new Client({ connectionString: process.env.LYSTO_TEST_DATABASE_URL })
  const equipmentId = randomUUID(),
    addressId = randomUUID(),
    requestId = randomUUID(),
    jobId = randomUUID(),
    reportId = randomUUID(),
    receiptId = randomUUID(),
    token = randomUUID()
  beforeAll(async () => {
    fixture = await setup
    await db.connect()
    const config = (
      await db.query(
        `select c.id category,i.id issue from public.service_categories c join public.service_issue_types i on i.category_id=c.id where c.active and i.active limit 1`
      )
    ).rows[0]
    await db.query(
      `insert into public.customer_addresses(id,customer_id,street,number,city,province) values($1,$2,'Privada','123','CABA','CABA')`,
      [addressId, fixture.accounts.customerA.entityId]
    )
    await db.query(
      `insert into public.customer_equipment(id,customer_id,address_id,category_id,nickname,equipment_type,notes) values($1,$2,$3,$4,'Equipo recibo','split','nota privada')`,
      [equipmentId, fixture.accounts.customerA.entityId, addressId, config.category]
    )
    await db.query(
      `insert into public.service_requests(id,customer_id,category_id,issue_type_id,status,equipment_id,address_id) values($1,$2,$3,$4,'completed',$5,$6)`,
      [requestId, fixture.accounts.customerA.entityId, config.category, config.issue, equipmentId, addressId]
    )
    await db.query(
      `insert into public.jobs(id,request_id,customer_id,professional_id,status,warranty_until) values($1,$2,$3,$4,'completed',current_date+30)`,
      [
        jobId,
        requestId,
        fixture.accounts.customerA.entityId,
        fixture.accounts.professionalApproved.entityId
      ]
    )
    await db.query(
      `insert into public.job_final_reports(id,job_id,equipment_id,real_diagnosis,work_done,final_state,maintenance_option,warranty_days,after_photo_ids,submission_fingerprint,internal_notes) values($1,$2,$3,'Diagnóstico privado','Limpieza y verificación funcional','resolved','none',30,array[$4]::uuid[],$5,'nota interna')`,
      [reportId, jobId, equipmentId, randomUUID(), 'c'.repeat(64)]
    )
    await db.query(
      `insert into public.receipts(id,job_id,final_report_id,public_token) values($1,$2,$3,$4)`,
      [receiptId, jobId, reportId, token]
    )
  })
  afterAll(async () => {
    try {
      await db.query('delete from private.receipt_token_events where receipt_id=$1', [receiptId])
      await db.query('delete from public.receipts where id=$1', [receiptId])
      await db.query('delete from public.job_final_reports where id=$1', [reportId])
      await db.query('delete from public.jobs where id=$1', [jobId])
      await db.query('delete from public.service_requests where id=$1', [requestId])
      await db.query('delete from public.customer_equipment where id=$1', [equipmentId])
      await db.query('delete from public.customer_addresses where id=$1', [addressId])
      await db.query(`delete from private.rate_limit_buckets where key like 'receipt:%'`)
    } finally {
      await db.end()
      await setup.cleanup()
    }
  })
  it('rejects malformed, invented and anonymous direct lookup', async () => {
    expect(await lookupPublicReceipt('bad', 'receipt-test')).toBeNull()
    expect(await lookupPublicReceipt(randomUUID(), 'receipt-test')).toBeNull()
    expect(
      (await fixture.accounts.customerA.client.rpc('lookup_public_receipt', { p_token: token }))
        .error?.code
    ).toBe('42501')
  })
  it('returns only the explicit public projection', async () => {
    const receipt = await lookupPublicReceipt(token, 'receipt-test')
    expect(receipt).toMatchObject({
      work_done: 'Limpieza y verificación funcional',
      final_state: 'resolved',
      confirmation_status: 'confirmed'
    })
    expect(Object.keys(receipt!)).toEqual([
      'service_name',
      'professional_name',
      'work_done',
      'final_state',
      'confirmation_status',
      'warranty_until',
      'next_maintenance_date',
      'issued_at'
    ])
    expect(JSON.stringify(receipt)).not.toMatch(/Privada|nota|email|phone|address|cost|amount/i)
  })
  it('revokes and regenerates atomically so the old URL fails', async () => {
    const revoked = await fixture.accounts.operations.client.rpc('manage_public_receipt_token', {
      p_receipt_id: receiptId,
      p_expected_token: token,
      p_action: 'revoke',
      p_reason: 'El cliente pidió retirar el enlace compartido.'
    })
    expect(revoked.error).toBeNull()
    expect(await lookupPublicReceipt(token, 'receipt-test')).toBeNull()
    const regenerated = await fixture.accounts.operations.client.rpc(
      'manage_public_receipt_token',
      {
        p_receipt_id: receiptId,
        p_expected_token: token,
        p_action: 'regenerate',
        p_reason: 'Se emite un vínculo nuevo después de la revocación.'
      }
    )
    expect(regenerated.error).toBeNull()
    const newToken = (regenerated.data as { publicToken: string }).publicToken
    expect(newToken).not.toBe(token)
    expect(await lookupPublicReceipt(token, 'receipt-test')).toBeNull()
    expect(await lookupPublicReceipt(newToken, 'receipt-test')).not.toBeNull()
  })
})
