import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { createFixtureAccounts } from './fixtures'
import { applyCanonicalPayment } from '@/lib/payments/marketplace-ledger'
import { closePaymentDatabaseForTests } from '@/lib/payments/marketplace-db'

describe('marketplace payment concurrency', () => {
  const pending = createFixtureAccounts()
  let fixture: Awaited<typeof pending>
  const database = new Client({ connectionString: process.env.LYSTO_TEST_DATABASE_URL })
  const second = new Client({ connectionString: process.env.LYSTO_TEST_DATABASE_URL })
  const requestId = randomUUID()
  const jobId = randomUUID()
  const quoteId = randomUUID()
  let checkoutId: string

  beforeAll(async () => {
    fixture = await pending
    process.env.MERCADOPAGO_DATABASE_URL = process.env.LYSTO_TEST_DATABASE_URL
    await Promise.all([database.connect(), second.connect()])
    const config = await database.query(
      `select c.id category_id,i.id issue_id from public.service_categories c
       join public.service_issue_types i on i.category_id=c.id where c.active and i.active limit 1`
    )
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
      [
        jobId,
        requestId,
        fixture.accounts.customerA.entityId,
        fixture.accounts.professionalApproved.entityId
      ]
    )
    await database.query(
      `insert into public.service_quotes(id,customer_id,address,input,quote,preferred_date,time_window,status,expires_at,
        accepted_at,request_id,version,revision,upload_intent_ids)
       values($1,$2,'{"street":"Corrientes","number":"1240","city":"CABA","province":"Buenos Aires"}',
        '{"materialsConfirmed":true}',
        '{"total":130000,"platformFee":23400,"professionalAmount":106600,"coverage":"covered"}',
        current_date+10,'09:00-12:00','accepted',now()+interval '1 hour',now(),$3,3,1,'{}')`,
      [quoteId, fixture.accounts.customerA.entityId, requestId]
    )
    await database.query(
      `insert into public.mp_split_connected_accounts(seller_id,mercado_pago_user_id,encrypted_access_token,
        access_token_expires_at,created_at,updated_at)
       values($1,'fixture-seller','encrypted-fixture',now()+interval '1 hour',now(),now())`,
      [fixture.accounts.professionalApproved.entityId]
    )
  })

  afterAll(async () => {
    try {
      await closePaymentDatabaseForTests()
      await database.query('delete from public.marketplace_checkouts where job_id=$1', [jobId])
      await database.query('delete from public.service_quotes where id=$1', [quoteId])
      await database.query('delete from public.jobs where id=$1', [jobId])
      await database.query('delete from public.service_requests where id=$1', [requestId])
      await database.query('delete from public.mp_split_connected_accounts where seller_id=$1', [
        fixture.accounts.professionalApproved.entityId
      ])
    } finally {
      await Promise.all([database.end(), second.end()])
      await pending.cleanup()
    }
  })

  it('returns one immutable checkout under simultaneous creation', async () => {
    const values = [fixture.accounts.customerA.entityId, jobId, null, false]
    const [first, concurrent] = await Promise.all([
      database.query('select * from private.prepare_marketplace_checkout($1,$2,$3,$4)', values),
      second.query('select * from private.prepare_marketplace_checkout($1,$2,$3,$4)', values)
    ])
    checkoutId = first.rows[0].id
    expect(concurrent.rows[0].id).toBe(checkoutId)
    expect(
      (
        await database.query(
          'select count(*)::integer count from public.marketplace_checkouts where job_id=$1',
          [jobId]
        )
      ).rows[0].count
    ).toBe(1)
    await expect(
      database.query('select * from private.prepare_marketplace_checkout($1,$2,$3,$4)', [
        fixture.accounts.customerA.entityId,
        jobId,
        null,
        true
      ])
    ).rejects.toThrow(/checkout_identity_changed/)
  })

  it('applies canonical money once and keeps mismatches out of the payment projection', async () => {
    const payment = {
      id: 'provider-payment-1',
      collector_id: 'fixture-seller',
      external_reference: checkoutId,
      currency_id: 'ARS',
      transaction_amount: 130000,
      transaction_amount_refunded: 0,
      live_mode: false,
      status: 'approved',
      date_last_updated: new Date().toISOString(),
      fee_details: [{ type: 'application_fee', amount: 23400 }],
      transaction_details: { net_received_amount: 106600 }
    }
    const [first, duplicate] = await Promise.all([
      applyCanonicalPayment(checkoutId, payment, 'concurrent-event'),
      applyCanonicalPayment(checkoutId, payment, 'concurrent-event')
    ])
    expect([first, duplicate]).toEqual(
      expect.arrayContaining([{ status: 'approved' }, { duplicate: true }])
    )
    expect(
      (
        await database.query(
          `select count(*)::integer count from public.payments where provider_payment_id='provider-payment-1'`
        )
      ).rows[0].count
    ).toBe(1)
    const mismatch = await applyCanonicalPayment(
      checkoutId,
      { ...payment, id: 'provider-payment-2', transaction_amount: 1 },
      'wrong-amount'
    )
    expect(mismatch).toEqual({ status: 'review' })
    expect(
      (
        await database.query(
          `select count(*)::integer count from public.payments where provider_payment_id='provider-payment-2'`
        )
      ).rows[0].count
    ).toBe(0)
  })
})
