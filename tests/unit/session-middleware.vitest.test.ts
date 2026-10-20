// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { SetAllCookies } from '@supabase/ssr'
const mocks = vi.hoisted(() => ({ create: vi.fn(), getClaims: vi.fn() }))
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.create }))
vi.mock('@/lib/supabase/env', () => ({
  assertPublicSupabaseEnv: () => ({ url: 'http://localhost:54321', anonKey: 'test-key' })
}))
import { middleware } from '@/middleware'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getClaims.mockResolvedValue({ data: { claims: null }, error: null })
  mocks.create.mockReturnValue({ auth: { getClaims: mocks.getClaims } })
})
it('recovers old provider return links before a private customer layout can reject the session', async () => {
  const id = '8688db78-1b3d-4762-a239-0feb06b2878f'
  const response = await middleware(new NextRequest(
    `https://lysto.test/app/trabajos/7cc28175-00a1-4ba9-ae4f-c87ccc6ef2b5?checkout=${id}&pago=retorno&status=approved&payment_id=untrusted`
  ))
  expect(response.status).toBe(307)
  expect(response.headers.get('location')).toBe(`https://lysto.test/app/pagos/resultado/${id}`)
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(mocks.create).not.toHaveBeenCalled()
})
it('does not redirect ordinary job visits or malformed return IDs', async () => {
  for (const suffix of ['', '?checkout=bad&pago=retorno']) {
    const response = await middleware(new NextRequest(
      `https://lysto.test/app/trabajos/7cc28175-00a1-4ba9-ae4f-c87ccc6ef2b5${suffix}`
    ))
    expect(response.headers.get('location')).toBeNull()
  }
})
it.each(['/app', '/pro/onboarding', '/pro/onboarding/' + 'a'.repeat(43)])(
  'refreshes downstream and browser cookies without losing private headers on %s',
  async (path) => {
    const request = new NextRequest('https://lysto.test' + path, {
      headers: { Cookie: 'sb-auth=old' }
    })
    mocks.create.mockImplementation(
      (_url, _key, options: { cookies: { setAll: SetAllCookies } }) => ({
        auth: {
          async getClaims() {
            await options.cookies.setAll([
              { name: 'sb-auth', value: 'refreshed', options: { httpOnly: true, path: '/' } }
            ])
            return { data: { claims: { sub: 'user' } }, error: null }
          }
        }
      })
    )
    const response = await middleware(request)
    expect(mocks.getClaims).not.toHaveBeenCalled()
    expect(request.cookies.get('sb-auth')?.value).toBe('refreshed')
    expect(response.headers.get('set-cookie')).toContain('sb-auth=refreshed')
    expect(response.headers.get('cache-control')).toContain('no-store')
    if (path.startsWith('/pro/onboarding')) {
      expect(response.headers.get('referrer-policy')).toBe('no-referrer')
      expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    }
  }
)
it.each(['/app', '/pro/dashboard', '/admin/dashboard', '/api/pricing/policy'])(
  'marks %s private even with no refresh',
  async (path) => {
    const response = await middleware(new NextRequest(`https://lysto.test${path}`))
    expect(response.headers.get('cache-control')).toContain('no-store')
  }
)
it.each([
  '/api/mercadopago/webhook',
  '/api/payments/webhook/apply',
  '/api/service-request/preview'
])('does not require user Auth for %s', async (path) => {
  const response = await middleware(new NextRequest(`https://lysto.test${path}`))
  expect(response.status).toBe(200)
  expect(mocks.create).not.toHaveBeenCalled()
})
it('leaves authenticated API session validation to the route handler', async () => {
  const response = await middleware(new NextRequest('https://lysto.test/api/customer/addresses'))
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(mocks.create).not.toHaveBeenCalled()
})
it('does not use panel-like public prefixes as private routes', async () => {
  await middleware(new NextRequest('https://lysto.test/application'))
  expect(mocks.create).not.toHaveBeenCalled()
})
it('preserves the origin of password recovery form submissions without leaking referrers to other sites', async () => {
  const response = await middleware(new NextRequest('https://lysto.test/restablecer?token_hash=' + 'a'.repeat(64)))
  expect(response.headers.get('referrer-policy')).toBe('same-origin')
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  expect(mocks.create).not.toHaveBeenCalled()
})
it('does not cache the closed public receipt or require a user login for it', async () => {
  const response = await middleware(
    new NextRequest('https://lysto.test/comprobante/arbitrary-token')
  )
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(mocks.create).not.toHaveBeenCalled()
})
it('lets the customer server session guard render a recoverable HTML error when refresh fails', async () => {
  mocks.getClaims.mockRejectedValue(new Error('private infrastructure detail'))
  const response = await middleware(new NextRequest('https://lysto.test/app'))
  expect(response.headers.get('x-middleware-next')).toBe('1')
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(await response.text()).not.toContain('private infrastructure detail')
})
it('preserves the existing closed non-customer outage response', async () => {
  mocks.getClaims.mockRejectedValue(new Error('private infrastructure detail'))
  const response = await middleware(new NextRequest('https://lysto.test/admin/dashboard'))
  expect(response.status).toBe(503)
  expect(JSON.stringify(await response.json())).not.toContain('private infrastructure detail')
})
