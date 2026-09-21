import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { buildOrderPayload, inspectCreatedOrder, inspectCanonicalOrder, verifyOrderWebhookSignature } from '@/lib/payments/orders'

const checkout = {
  id: '4fbf1a40-cc10-4a10-88df-a7bbb3915651',
  job_id: 'job-1', extra_id: null,
  seller_account_id: 'seller-12', amount: '100.05', marketplace_fee: '18.01',
  live_mode: false, created_at: new Date('2026-09-20T12:00:00Z'),
  expires_at: new Date('2026-09-20T12:30:00Z')
}

describe('Checkout Pro Orders split contract', () => {
  it('freezes the split, reference, expiry and return URLs', () => {
    expect(buildOrderPayload(checkout, 'https://lysto.test')).toMatchObject({
      type: 'online', processing_mode: 'manual', total_amount: '100.05',
      marketplace_fee: '18.01', external_reference: checkout.id,
      expiration_time: 'PT1800S',
      items: [{ quantity: 1, unit_price: '100.05', total_amount: '100.05' }],
      config: { online: {
        success_url: 'https://lysto.test/app/trabajos/job-1?pago=retorno',
        pending_url: 'https://lysto.test/app/trabajos/job-1?pago=pendiente',
        failure_url: 'https://lysto.test/app/trabajos/job-1?pago=reintentar'
      } }
    })
  })

  it('accepts only a canonical test order for the same seller and amount', () => {
    const raw = { id: 'ORDTST01ABC', type: 'online', processing_mode: 'manual',
      external_reference: checkout.id, total_amount: '100.05', marketplace_fee: '18.01',
      currency: 'ARS', user_id: 'seller-12',
      checkout_url: 'https://www.mercadopago.com.ar/checkout/v1/redirect?order_id=ORDTST01ABC' }
    expect(inspectCreatedOrder(checkout, raw)).toEqual({ id: raw.id, checkoutUrl: raw.checkout_url })
    expect(() => inspectCreatedOrder(checkout, { ...raw, marketplace_fee: '17.00' })).toThrow('invalid_provider_response')
    expect(() => inspectCreatedOrder(checkout, { ...raw, user_id: 'other' })).toThrow('invalid_provider_response')
    expect(() => inspectCreatedOrder(checkout, { ...raw, id: 'ORD01ABC' })).toThrow('payment_mode_mismatch')
    expect(() => inspectCreatedOrder(checkout, { ...raw, checkout_url: 'https://evil.test/' })).toThrow('invalid_provider_response')
  })

  it('approves only an accredited single payment in the canonical order', () => {
    const order = { id: 'ORDTST01ABC', type: 'online', processing_mode: 'manual',
      external_reference: checkout.id, total_amount: '100.05', marketplace_fee: '18.01',
      currency: 'ARS', user_id: 'seller-12', status: 'processed', status_detail: 'accredited',
      total_paid_amount: '100.05', last_updated_date: '2026-09-20T12:10:00Z',
      transactions: { payments: [{ id: 'PAY01ABC', amount: '100.05', paid_amount: '100.05', status: 'processed', status_detail: 'accredited' }], refunds: [], chargebacks: [] } }
    expect(inspectCanonicalOrder(checkout, order)).toMatchObject({ status: 'approved', paymentId: 'PAY01ABC', issues: [] })
    expect(inspectCanonicalOrder(checkout, { ...order, marketplace_fee: '0.00' }).status).toBe('review')
    expect(inspectCanonicalOrder(checkout, { ...order, transactions: { ...order.transactions, payments: [] } }).status).toBe('review')
    expect(inspectCanonicalOrder(checkout, { ...order, transactions: { ...order.transactions, chargebacks: [{}] } }).status).toBe('review')
  })

  it('authenticates the signed order ID and rejects a different body ID', () => {
    const orderId = 'ORDTST01ABC', requestId = 'request-1', ts = '1758370200000', secret = 'hook-secret'
    const signature = createHmac('sha256', secret).update(`id:${orderId};request-id:${requestId};ts:${ts};`).digest('hex')
    const input = { headers: { 'x-signature': `ts=${ts},v1=${signature}`, 'x-request-id': requestId },
      query: { 'data.id': orderId, type: 'order' }, body: { type: 'order', data: { id: orderId } } }
    expect(verifyOrderWebhookSignature(input, secret)).toBe(orderId)
    expect(() => verifyOrderWebhookSignature({ ...input, body: { type: 'order', data: { id: 'ORDTST01OTHER' } } }, secret)).toThrow()
    expect(() => verifyOrderWebhookSignature({ ...input, headers: { ...input.headers, 'x-signature': `ts=${ts},v1=${'0'.repeat(64)}` } }, secret)).toThrow()
  })
})
