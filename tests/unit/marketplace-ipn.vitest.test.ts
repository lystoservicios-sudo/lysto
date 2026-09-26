// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import * as config from '@/lib/payments/marketplace-config'
import * as marketplace from '@/lib/payments/marketplace'
import { OAuthManager } from '@waltergaltieri/mercadopago-split'

const state = vi.hoisted(() => ({ query: vi.fn(), apply: vi.fn() }))
vi.mock('@/lib/payments/marketplace-db', () => ({ paymentDatabase: () => ({ query: state.query }) }))
vi.mock('@/lib/payments/marketplace-ledger', () => ({ applyCanonicalPayment: state.apply }))

const checkoutId = '92000000-0000-4000-8000-000000000001'
const checkout = {
  id: checkoutId,
  professional_id: 'pro-1',
  seller_account_id: '123',
  amount: '100.00',
  marketplace_fee: '18.00',
  live_mode: false,
  checkout_protocol: 'preferences'
}
const canonical = {
  id: 123, collector_id: 123, external_reference: checkoutId,
  currency_id: 'ARS', transaction_amount: 100, transaction_amount_refunded: 0,
  live_mode: false, status: 'approved', date_last_updated: '2026-09-26T19:00:00Z',
  fee_details: [{ type: 'application_fee', amount: 18 }]
}
type IpnInput = { checkoutId: string; token: string; topic: 'payment' | 'merchant_order'; resourceId: string }
const createToken = (config as unknown as { ipnToken?: (id: string, key: string) => string }).ipnToken
const handleIpn = (marketplace as unknown as { handleMarketplaceIpn?: (input: IpnInput) => Promise<{ outcome: string }> }).handleMarketplaceIpn

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('PAYMENTS_PROVIDER', 'mercadopago_split')
  vi.stubEnv('MERCADOPAGO_MODE', 'test')
  vi.stubEnv('MERCADOPAGO_MARKETPLACE_CLIENT_ID', '123')
  vi.stubEnv('MERCADOPAGO_MARKETPLACE_CLIENT_SECRET', 'secret')
  vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET', '')
  vi.stubEnv('MERCADOPAGO_ENCRYPTION_KEY', Buffer.alloc(32, 1).toString('base64'))
  vi.stubEnv('MERCADOPAGO_DATABASE_URL', 'postgres://unused')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lysto.test')
  state.query.mockResolvedValue({ rows: [checkout] })
  state.apply.mockResolvedValue({ status: 'approved' })
  vi.spyOn(OAuthManager.prototype, 'getValidAccessToken').mockResolvedValue('TEST-seller-token')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(canonical), { status: 200 })))
})

it('derives a checkout-bound IPN token without exposing the encryption key', () => {
  expect(createToken).toBeTypeOf('function')
  const key = Buffer.alloc(32, 1).toString('base64')
  expect(createToken!(checkoutId, key)).toMatch(/^[a-f0-9]{64}$/)
  expect(createToken!('92000000-0000-4000-8000-000000000002', key)).not.toBe(createToken!(checkoutId, key))
})

it('rejects an invalid IPN token before accessing checkout data', async () => {
  expect(handleIpn).toBeTypeOf('function')
  await expect(handleIpn!({ checkoutId, token: 'a'.repeat(64), topic: 'payment', resourceId: '123' })).rejects.toThrow('invalid_notification')
  expect(state.query).not.toHaveBeenCalled()
})

it('ignores an unrelated canonical payment instead of changing this checkout', async () => {
  expect(handleIpn).toBeTypeOf('function')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...canonical, external_reference: 'other' }), { status: 200 })))
  const result = await handleIpn!({ checkoutId, token: createToken!(checkoutId, process.env.MERCADOPAGO_ENCRYPTION_KEY!), topic: 'payment', resourceId: '123' })
  expect(result).toEqual({ outcome: 'ignored' })
  expect(state.apply).not.toHaveBeenCalled()
})

it('applies only the provider-fetched payment for this seller and checkout', async () => {
  expect(handleIpn).toBeTypeOf('function')
  const result = await handleIpn!({ checkoutId, token: createToken!(checkoutId, process.env.MERCADOPAGO_ENCRYPTION_KEY!), topic: 'payment', resourceId: '123' })
  expect(result).toEqual({ outcome: 'approved' })
  expect(state.apply).toHaveBeenCalledWith(checkoutId, canonical, 'ipn:123:2026-09-26T19:00:00Z')
  expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://api.mercadopago.com/v1/payments/123')
})

it('does not skip a forced return lookup when a recent check holds the 30-second throttle', async () => {
  state.query.mockResolvedValueOnce({ rowCount: 0, rows: [] })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [], paging: { total: 0 } }), { status: 200 })))
  await expect(marketplace.reconcileCheckout(checkout as never, true)).resolves.toBe(true)
  expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/v1/payments/search?external_reference=')
})
