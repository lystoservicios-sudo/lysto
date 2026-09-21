import { describe, expect, it } from 'vitest'
import { checkoutAmounts, buildPreferencePayload, inspectPayment, checkoutProtocol } from '@/lib/payments/checkout-contract'

const checkout = { id: 'c1', professional_id: 'pro1', seller_account_id: '123', amount: '301600.00', marketplace_fee: '54288.00', live_mode: false, created_at: new Date('2026-09-10T12:00:00Z'), expires_at: new Date('2026-09-10T13:00:00Z') }
const payment = { id: 111, collector_id: 123, external_reference: 'c1', currency_id: 'ARS', transaction_amount: 301600, transaction_amount_refunded: 0, live_mode: false, status: 'approved', date_last_updated: '2026-09-10T12:10:00Z', fee_details: [{ type: 'application_fee', amount: 54288 }, { type: 'mercadopago_fee', amount: 12000 }], transaction_details: { net_received_amount: 235312 } }

describe('frozen marketplace payment contract', () => {
  it('preserves legacy preferences and rejects mixed checkout identities', () => {
    expect(checkoutProtocol({ checkout_protocol: 'preferences', preference_id: 'pref-1', order_id: null })).toBe('preferences')
    expect(checkoutProtocol({ checkout_protocol: 'orders', preference_id: null, order_id: 'ORD-1' })).toBe('orders')
    expect(() => checkoutProtocol({ checkout_protocol: 'orders', preference_id: 'pref-1', order_id: 'ORD-1' })).toThrow('checkout_identity_changed')
  })
  it('splits exactly in cents without a second markup or whole-peso rounding', () => {
    expect(checkoutAmounts('100.05', '18.01')).toEqual({ total: '100.05', fee: '18.01', professional: '82.04' })
    expect(checkoutAmounts('50000.00', '0')).toEqual({ total: '50000.00', fee: '0.00', professional: '50000.00' })
    expect(() => checkoutAmounts('100', '100.01')).toThrow()
    expect(() => checkoutAmounts('100.005', '18')).toThrow()
  })
  it('sets actual Checkout Pro expiration and a dedicated webhook URL', () => {
    const payload = buildPreferencePayload({ external_reference: 'c1', date_of_expiration: checkout.expires_at.toISOString(), items: [], marketplace_fee: 0, back_urls: { success: 'https://lysto.test/ok', pending: 'https://lysto.test/pending', failure: 'https://lysto.test/fail' } }, 'https://lysto.test', checkout.created_at)
    expect(payload.expires).toBe(true)
    expect(payload.expiration_date_to).toBe(checkout.expires_at.toISOString())
    expect(payload.notification_url).toBe('https://lysto.test/api/mercadopago/webhook')
    expect(payload).not.toHaveProperty('date_of_expiration')
  })
  it('uses provider fees as observed costs, not another Lysto charge', () => {
    expect(inspectPayment(checkout, payment)).toMatchObject({ issues: [], status: 'approved', providerFee: '12000.00', netReceived: '235312.00' })
  })
  it.each([
    ['amount', { transaction_amount: 1 }], ['seller', { collector_id: 999 }],
    ['currency', { currency_id: 'USD' }], ['reference', { external_reference: 'other' }],
    ['mode', { live_mode: true }], ['fee', { fee_details: [] }],
  ])('does not approve a %s mismatch', (_, change) => {
    expect(inspectPayment(checkout, { ...payment, ...change }).issues.length).toBeGreaterThan(0)
  })
  it('preserves partial refunds and canonical update time', () => {
    expect(inspectPayment(checkout, { ...payment, transaction_amount_refunded: 1000 })).toMatchObject({ status: 'partially_refunded', refundedAmount: '1000.00', updatedAt: '2026-09-10T12:10:00.000Z' })
  })
  it('rejects absent provider update time instead of ordering by webhook arrival', () => {
    expect(() => inspectPayment(checkout, { ...payment, date_last_updated: undefined })).toThrow()
  })
  it.each(['pending','in_process','rejected','cancelled'])('does not demand a debited commission for %s', status=>{
    expect(inspectPayment(checkout,{...payment,status,fee_details:[]}).issues).toEqual([])
  })
  it('accepts commission reversals while recording a full refund',()=>{
    expect(inspectPayment(checkout,{...payment,status:'refunded',transaction_amount_refunded:301600,fee_details:[] })).toMatchObject({status:'refunded',issues:[]})
  })
})
