// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ actor: vi.fn(), create: vi.fn(), complete: vi.fn(), cookie: vi.fn() }))
vi.mock('@/lib/payments/marketplace-session', () => ({ onboardingMarketplaceProfessional: mocks.actor }))
vi.mock('@/lib/payments/marketplace', () => ({ marketplaceGateway: () => ({ oauth: {
  createAuthorizationUrl: mocks.create, completeAuthorization: mocks.complete
} }) }))
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

it('returns an applicant to onboarding after a valid callback', async () => {
  const key = Buffer.alloc(32, 1).toString('base64')
  mocks.cookie.mockReturnValue({ value: oauthBinding('nonce-1', 'user-1', 'pro-1', key) })
  const response = await GET(new Request('https://lysto.test/api/mercadopago/oauth/callback?state=nonce-1&code=code-1'))
  expect(response.status).toBe(307)
  expect(response.headers.get('location')).toBe('https://lysto.test/pro/onboarding?conexion=actualizada')
  expect(mocks.complete).toHaveBeenCalledWith({ code: 'code-1', state: 'nonce-1' })
})
