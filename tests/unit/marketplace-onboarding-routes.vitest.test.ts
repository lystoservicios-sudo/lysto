// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ actor: vi.fn(), create: vi.fn(), complete: vi.fn(), cookie: vi.fn(), gateway: vi.fn(), oauth: vi.fn() }))
vi.mock('@/lib/payments/marketplace-session', () => ({ onboardingMarketplaceProfessional: mocks.actor }))
vi.mock('@/lib/payments/marketplace', () => ({
  marketplaceGateway: mocks.gateway,
  marketplaceOAuth: mocks.oauth
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookie }) }))
import { POST } from '@/app/api/mercadopago/oauth/authorize/route'
import { GET } from '@/app/api/mercadopago/oauth/callback/route'
import { oauthBinding } from '@/lib/payments/marketplace-config'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('PAYMENTS_PROVIDER', 'mercadopago_split')
  vi.stubEnv('MERCADOPAGO_MARKETPLACE_CLIENT_ID', '123')
  vi.stubEnv('MERCADOPAGO_MARKETPLACE_CLIENT_SECRET', 'test-secret')
  vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET', 'test-hook')
  vi.stubEnv('MERCADOPAGO_ENCRYPTION_KEY', Buffer.alloc(32, 1).toString('base64'))
  vi.stubEnv('MERCADOPAGO_DATABASE_URL', 'postgres://unused')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lysto.test')
  vi.stubEnv('MERCADOPAGO_MODE', 'test')
  mocks.actor.mockResolvedValue({ userId: 'user-1', professionalId: 'pro-1', status: 'form_started' })
  mocks.create.mockResolvedValue({ url: 'https://www.mercadopago.com.ar/authorization?state=nonce-1' })
  mocks.complete.mockResolvedValue(undefined)
  mocks.gateway.mockReturnValue({ oauth: { createAuthorizationUrl: mocks.create, completeAuthorization: mocks.complete } })
  mocks.oauth.mockReturnValue({ createAuthorizationUrl: mocks.create, completeAuthorization: mocks.complete })
})

it('starts OAuth without a webhook signature and without constructing the webhook gateway', async () => {
  vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET', '')
  const response = await POST(new Request('https://lysto.test/api/mercadopago/oauth/authorize', {
    method: 'POST', headers: { Origin: 'https://lysto.test' }
  }))
  expect(response.status).toBe(200)
  expect(mocks.oauth).toHaveBeenCalledOnce()
  expect(mocks.gateway).not.toHaveBeenCalled()
})

it('authorizes only the bound applicant and binds the provider state to that session', async () => {
  const response = await POST(new Request('https://lysto.test/api/mercadopago/oauth/authorize', {
    method: 'POST', headers: { Origin: 'https://lysto.test' }
  }))
  expect(response.status).toBe(200)
  expect(mocks.create).toHaveBeenCalledWith({ sellerId: 'pro-1' })
  expect(response.headers.get('set-cookie')).toContain('lysto_mp_oauth=')
})

it('rejects a callback with a cookie from a different session', async () => {
  const key = Buffer.alloc(32, 1).toString('base64')
  mocks.cookie.mockReturnValue({ value: oauthBinding('nonce-1', 'other-user', 'pro-1', key) })
  const response = await GET(new Request('https://lysto.test/api/mercadopago/oauth/callback?state=nonce-1&code=code-1'))
  expect(response.status).toBe(403)
  expect(mocks.complete).not.toHaveBeenCalled()
})

it('returns an applicant to the professional dashboard after a valid callback', async () => {
  const key = Buffer.alloc(32, 1).toString('base64')
  mocks.cookie.mockReturnValue({ value: oauthBinding('nonce-1', 'user-1', 'pro-1', key) })
  const response = await GET(new Request('https://lysto.test/api/mercadopago/oauth/callback?state=nonce-1&code=code-1'))
  expect(response.status).toBe(307)
  expect(response.headers.get('location')).toBe('https://lysto.test/pro/dashboard?conexion=actualizada')
  expect(mocks.complete).toHaveBeenCalledWith({ code: 'code-1', state: 'nonce-1' })
})

it('binds the allowlisted onboarding destination to the same authorization', async () => {
  const response = await POST(new Request('https://lysto.test/api/mercadopago/oauth/authorize', {
    method: 'POST', headers: { Origin: 'https://lysto.test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnTo: 'onboarding' })
  }))
  expect(response.status).toBe(200)
  const value = response.cookies.get('lysto_mp_oauth_return')?.value
  expect(value).toMatch(/^onboarding\.[a-f0-9]{64}$/)
  const key = Buffer.alloc(32, 1).toString('base64')
  mocks.cookie.mockImplementation((name: string) => ({ value: name === 'lysto_mp_oauth_return' ? value : oauthBinding('nonce-1', 'user-1', 'pro-1', key) }))
  const callback = await GET(new Request('https://lysto.test/api/mercadopago/oauth/callback?state=nonce-1&code=code-1'))
  expect(callback.headers.get('location')).toBe('https://lysto.test/pro/onboarding?conexion=actualizada')
  expect(callback.cookies.get('lysto_mp_oauth_return')?.value).toBe('')
})

it('rejects arbitrary OAuth return destinations before creating a provider state', async () => {
  const response = await POST(new Request('https://lysto.test/api/mercadopago/oauth/authorize', {
    method: 'POST', headers: { Origin: 'https://lysto.test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnTo: 'https://attacker.test' })
  }))
  expect(response.status).toBe(400)
  expect(mocks.create).not.toHaveBeenCalled()
})

it('ignores a destination signature from another authorization', async () => {
  const key = Buffer.alloc(32, 1).toString('base64')
  mocks.cookie.mockImplementation((name: string) => ({ value: name === 'lysto_mp_oauth_return'
    ? `onboarding.${oauthBinding('other-nonce:onboarding', 'user-1', 'pro-1', key)}`
    : oauthBinding('nonce-1', 'user-1', 'pro-1', key) }))
  const response = await GET(new Request('https://lysto.test/api/mercadopago/oauth/callback?state=nonce-1&code=code-1'))
  expect(response.headers.get('location')).toBe('https://lysto.test/pro/dashboard?conexion=actualizada')
})

it('returns a bound cancellation to onboarding without exchanging an authorization code', async () => {
  const key = Buffer.alloc(32, 1).toString('base64')
  mocks.cookie.mockImplementation((name: string) => ({ value: name === 'lysto_mp_oauth_return'
    ? `onboarding.${oauthBinding('nonce-1:onboarding', 'user-1', 'pro-1', key)}`
    : oauthBinding('nonce-1', 'user-1', 'pro-1', key) }))
  const response = await GET(new Request('https://lysto.test/api/mercadopago/oauth/callback?state=nonce-1&error=access_denied'))
  expect(response.status).toBe(307)
  expect(response.headers.get('location')).toBe('https://lysto.test/pro/onboarding?conexion=cancelada')
  expect(mocks.complete).not.toHaveBeenCalled()
  expect(response.cookies.get('lysto_mp_oauth')?.value).toBe('')
})

it('does not accept an unbound cancellation', async () => {
  mocks.cookie.mockReturnValue(undefined)
  const response = await GET(new Request('https://lysto.test/api/mercadopago/oauth/callback?state=nonce-1&error=access_denied'))
  expect(response.status).toBe(403)
  expect(response.headers.get('location')).toBeNull()
  expect(mocks.complete).not.toHaveBeenCalled()
  expect(response.cookies.get('lysto_mp_oauth_return')?.value).toBe('')
})

it('clears a prior return destination when a normal authorization is started', async () => {
  const response = await POST(new Request('https://lysto.test/api/mercadopago/oauth/authorize', {
    method: 'POST', headers: { Origin: 'https://lysto.test' }
  }))
  expect(response.cookies.get('lysto_mp_oauth_return')?.value).toBe('')
})

it.each(['null', '{', '{"returnTo":"onboarding","sellerId":"other"}', '"onboarding"'])('rejects malformed or extra authorization inputs: %s', async body => {
  const response = await POST(new Request('https://lysto.test/api/mercadopago/oauth/authorize', {
    method: 'POST', headers: { Origin: 'https://lysto.test', 'Content-Type': 'application/json' }, body
  }))
  expect(response.status).toBe(400)
  expect(mocks.create).not.toHaveBeenCalled()
})

it('stops reading an oversized streamed authorization body rather than buffering all chunks', async () => {
  let reads = 0
  const cancel = vi.fn()
  const body = new ReadableStream({
    pull(controller) { controller.enqueue(new TextEncoder().encode(' '.repeat(256))); if (++reads === 8) controller.close() },
    cancel
  })
  const request = new Request('https://lysto.test/api/mercadopago/oauth/authorize', {
    method: 'POST', headers: { Origin: 'https://lysto.test', 'Content-Type': 'application/json' }, body, duplex: 'half'
  } as RequestInit)
  const response = await POST(request)
  expect(response.status).toBe(400)
  expect(cancel).toHaveBeenCalledOnce()
  expect(reads).toBeLessThan(8)
  expect(mocks.create).not.toHaveBeenCalled()
})

it('returns a valid bound onboarding callback failure to a fixed retry destination', async () => {
  const key = Buffer.alloc(32, 1).toString('base64')
  mocks.cookie.mockImplementation((name: string) => ({ value: name === 'lysto_mp_oauth_return'
    ? `onboarding.${oauthBinding('nonce-1:onboarding', 'user-1', 'pro-1', key)}`
    : oauthBinding('nonce-1', 'user-1', 'pro-1', key) }))
  mocks.complete.mockRejectedValueOnce(new Error('provider request failed: sensitive-value'))
  const response = await GET(new Request('https://lysto.test/api/mercadopago/oauth/callback?state=nonce-1&code=code-1&returnTo=https://attacker.test'))
  expect(response.status).toBe(307)
  expect(response.headers.get('location')).toBe('https://lysto.test/pro/onboarding?conexion=fallida')
  expect(response.cookies.get('lysto_mp_oauth')?.value).toBe('')
  expect(response.cookies.get('lysto_mp_oauth_return')?.value).toBe('')
  expect(response.headers.get('location')).not.toContain('sensitive-value')
})

it('keeps a default dashboard callback failure as a private error response', async () => {
  const key = Buffer.alloc(32, 1).toString('base64')
  mocks.cookie.mockImplementation((name: string) => name === 'lysto_mp_oauth' ? { value: oauthBinding('nonce-1', 'user-1', 'pro-1', key) } : undefined)
  mocks.complete.mockRejectedValueOnce(new Error('provider request failed'))
  const response = await GET(new Request('https://lysto.test/api/mercadopago/oauth/callback?state=nonce-1&code=code-1'))
  expect(response.status).toBe(400)
  expect(response.headers.get('location')).toBeNull()
})
