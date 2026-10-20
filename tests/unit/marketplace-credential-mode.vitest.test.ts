// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { OAuthManager } from '@waltergaltieri/mercadopago-split'
import { marketplacePreferenceClient, providerJson } from '@/lib/payments/marketplace'
import { checkoutBackUrls } from '@/lib/payments/checkout-contract'
import { checkPaymentReturnToken, issuePaymentReturnToken } from '@/lib/payments/payment-return-token'

const fetcher = vi.fn()
const spec = () => ({
  sellerId: 'professional-qa', externalReference: 'extra-qa', idempotencyKey: 'extra-qa-1',
  marketplaceFee: '0.00',
  items: [{ id: 'extra-qa', title: 'Adicional QA', currencyId: 'ARS', quantity: 1, unitPrice: '500.00' }],
  metadata: { lysto_created_at: new Date().toISOString() },
  backUrls: { success: 'https://lysto.test/ok', failure: 'https://lysto.test/fail', pending: 'https://lysto.test/pending' },
  expiresAt: new Date(Date.now() + 600_000)
})
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })

beforeEach(() => {
  for (const [key, value] of Object.entries({
    PAYMENTS_PROVIDER: 'mercadopago_split', MERCADOPAGO_MODE: 'test',
    MERCADOPAGO_MARKETPLACE_CLIENT_ID: '123', MERCADOPAGO_MARKETPLACE_CLIENT_SECRET: 'unused',
    MERCADOPAGO_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
    MERCADOPAGO_DATABASE_URL: 'postgres://unused', NEXT_PUBLIC_APP_URL: 'https://lysto.test'
  })) vi.stubEnv(key, value)
  vi.spyOn(OAuthManager.prototype, 'getValidAccessToken').mockResolvedValue('APP_USR-test-account')
  fetcher.mockReset()
  fetcher.mockImplementation(async (url: string) => url.endsWith('/users/me')
    ? json({ id: 1234, tags: ['test_user'] })
    : json({ id: 'qa-preference', init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=qa-preference' }))
  vi.stubGlobal('fetch', fetcher)
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

it('creates a zero-fee preference with a provider-verified APP_USR test account', async () => {
  await expect(marketplacePreferenceClient().createPreference(spec())).resolves.toMatchObject({ preferenceId: 'qa-preference' })
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    'https://api.mercadopago.com/users/me', 'https://api.mercadopago.com/checkout/preferences'
  ])
  expect(JSON.parse(fetcher.mock.calls[1][1].body).marketplace_fee).toBe(0)
})

it.each([
  ['real account', { id: 1234, tags: ['normal'] }, 200],
  ['missing classification', { id: 1234 }, 200],
  ['malformed classification', { id: 1234, tags: 'test_user' }, 200],
  ['missing identity', { tags: ['test_user'] }, 200],
  ['unavailable provider', { message: 'unavailable' }, 503],
  ['revoked credential', { message: 'unauthorized' }, 401]
])('refuses a %s before creating any preference in test mode', async (_name, account, status) => {
  fetcher.mockResolvedValue(json(account, status as number))
  await expect(marketplacePreferenceClient().createPreference(spec())).rejects.toThrow()
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls[0][0]).toBe('https://api.mercadopago.com/users/me')
})

it('refuses APP_USR test users in live mode', async () => {
  vi.stubEnv('MERCADOPAGO_MODE', 'live')
  await expect(marketplacePreferenceClient().createPreference(spec())).rejects.toThrow()
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('accepts a verified real account in live mode', async () => {
  vi.stubEnv('MERCADOPAGO_MODE', 'live')
  fetcher.mockResolvedValueOnce(json({ id: 1234, tags: ['normal'] }))
  await expect(marketplacePreferenceClient().createPreference(spec())).resolves.toMatchObject({ preferenceId: 'qa-preference' })
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('retains static TEST credentials in test mode', async () => {
  vi.mocked(OAuthManager.prototype.getValidAccessToken).mockResolvedValue('TEST-legacy')
  await expect(marketplacePreferenceClient().createPreference(spec())).resolves.toMatchObject({ preferenceId: 'qa-preference' })
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('rejects static TEST credentials in live mode without a provider mutation', async () => {
  vi.stubEnv('MERCADOPAGO_MODE', 'live')
  vi.mocked(OAuthManager.prototype.getValidAccessToken).mockResolvedValue('TEST-legacy')
  await expect(marketplacePreferenceClient().createPreference(spec())).rejects.toThrow()
  expect(fetcher).not.toHaveBeenCalled()
})

it('records provider failure status without recording credentials or response data', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  fetcher.mockResolvedValue(json({
    error: 'invalid_auto_return', message: 'private buyer@example.test',
    access_token: 'secret-token', cause: [{ description: 'private details' }]
  }, 400))
  await expect(providerJson('/checkout/preferences', 'secret-token', 'POST', { private: true }))
    .rejects.toThrow('provider_unavailable')
  expect(log).toHaveBeenCalledWith(JSON.stringify({
    event: 'marketplace_provider_failed', operation: 'create_preference',
    status: 400, code: 'invalid_auto_return'
  }))
})

it('redacts unrecognized provider codes and resource identifiers', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  fetcher.mockResolvedValue(json({ error: 'private-buyer@example.test' }, 503))
  await expect(providerJson('/v1/payments/private-payment-id', 'secret-token'))
    .rejects.toThrow('provider_unavailable')
  expect(log).toHaveBeenCalledWith(JSON.stringify({
    event: 'marketplace_provider_failed', operation: 'other',
    status: 503, code: 'unclassified'
  }))
})

it('passes production signed receipt URLs through the actual split SDK', async () => {
  const id = '92000000-0000-4000-8000-000000000001'
  const key = Buffer.alloc(32, 1).toString('base64')
  const expires = new Date(Date.now() + 600_000)
  const token = issuePaymentReturnToken(id, key, expires)
  const backUrls = checkoutBackUrls('https://lystohogar.com', id, id, token)
  await expect(marketplacePreferenceClient().createPreference({ ...spec(), backUrls }))
    .resolves.toMatchObject({ preferenceId: 'qa-preference' })
  for (const value of Object.values(backUrls)) {
    expect(value.length).toBeLessThanOrEqual(150)
    expect(checkPaymentReturnToken(id, new URL(value).searchParams.get('confirmacion')!, key)).toBe(true)
  }
  expect(fetcher).toHaveBeenCalledTimes(2)
})
