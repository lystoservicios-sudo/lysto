// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'

const state = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@/lib/payments/marketplace-db', () => ({
  paymentDatabase: () => ({ query: state.query }),
  paymentTransaction: async (work: (db: { query: typeof state.query }) => Promise<unknown>) =>
    work({ query: state.query })
}))

import { claimCheckout, prepareCheckout } from '@/lib/payments/marketplace-ledger'
import { handleMarketplaceWebhook, renewCheckout } from '@/lib/payments/marketplace'

const prepared = { id: 'checkout-1', checkout_protocol: 'preferences',
  preference_id: null, status: 'creating' }

beforeEach(() => {
  vi.unstubAllEnvs()
  state.query.mockReset()
  state.query.mockResolvedValue({ rows: [prepared] })
})

it('keeps new checkouts on Preferences while Orders is disabled', async () => {
  vi.stubEnv('MERCADOPAGO_ORDERS_ENABLED', 'false')
  expect((await prepareCheckout('customer', 'job', undefined, false)).checkout_protocol)
    .toBe('preferences')
  expect(state.query).toHaveBeenCalledTimes(1)
})

it('promotes an unissued checkout to Orders only after the gate is enabled', async () => {
  vi.stubEnv('MERCADOPAGO_ORDERS_ENABLED', 'true')
  state.query.mockResolvedValueOnce({ rows: [prepared] })
    .mockResolvedValueOnce({ rows: [{ ...prepared, checkout_protocol: 'orders' }] })
  expect((await prepareCheckout('customer', 'job', undefined, false)).checkout_protocol)
    .toBe('orders')
  expect(state.query.mock.calls[1][0]).toContain("checkout_protocol='orders'")
})

it('never promotes an uncertain Preferences attempt when Orders is enabled', async () => {
  vi.stubEnv('MERCADOPAGO_ORDERS_ENABLED', 'true')
  const uncertain = { ...prepared, preference_spec: { externalReference: 'checkout-1' } }
  state.query.mockResolvedValueOnce({ rows: [uncertain] })
  expect((await prepareCheckout('customer', 'job', undefined, false)).checkout_protocol)
    .toBe('preferences')
  expect(state.query).toHaveBeenCalledTimes(1)
})

it('does not claim a checkout already closed by finance', async () => {
  state.query.mockResolvedValueOnce({ rows: [{ ...prepared, checkout_protocol: 'orders',
    closed_for_new_payments_at: new Date(), expires_at: new Date(Date.now() + 60_000) }] })
  await expect(claimCheckout('checkout-1', 'https://lysto.test')).rejects.toThrow('checkout_review')
  expect(state.query).toHaveBeenCalledTimes(1)
})

it('does not renew a financially closed Order', async () => {
  vi.stubEnv('MERCADOPAGO_ORDERS_ENABLED', 'true')
  await expect(renewCheckout({ ...prepared, checkout_protocol: 'orders',
    order_id: 'ORDTST01ABC', closed_for_new_payments_at: new Date() } as never))
    .rejects.toThrow('checkout_review')
  expect(state.query).not.toHaveBeenCalled()
})

it('asks Mercado Pago to retry an authenticated Order notification arriving before persistence', async () => {
  vi.stubEnv('PAYMENTS_PROVIDER', 'mercadopago_split')
  vi.stubEnv('MERCADOPAGO_MODE', 'test')
  vi.stubEnv('MERCADOPAGO_MARKETPLACE_CLIENT_ID', 'client')
  vi.stubEnv('MERCADOPAGO_MARKETPLACE_CLIENT_SECRET', 'secret')
  vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET', 'hook')
  vi.stubEnv('MERCADOPAGO_ENCRYPTION_KEY', Buffer.alloc(32, 1).toString('base64'))
  vi.stubEnv('MERCADOPAGO_DATABASE_URL', 'postgres://unused')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lysto.test')
  state.query.mockResolvedValueOnce({ rows: [] })
  const orderId = 'ORDTST01ABC', requestId = 'request-1', ts = '1789912800'
  const hash = createHmac('sha256', 'hook')
    .update(`id:${orderId};request-id:${requestId};ts:${ts};`).digest('hex')
  expect(await handleMarketplaceWebhook({
    headers: { 'x-request-id': requestId, 'x-signature': `ts=${ts},v1=${hash}` },
    query: { type: 'order', 'data.id': orderId },
    body: { type: 'order', data: { id: orderId } }
  })).toEqual({ outcome: 'in_progress' })
})
