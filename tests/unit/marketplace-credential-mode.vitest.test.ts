// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { OAuthManager } from '@waltergaltieri/mercadopago-split'
import { marketplacePreferenceClient } from '@/lib/payments/marketplace'

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
