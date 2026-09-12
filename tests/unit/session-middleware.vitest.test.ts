// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { SetAllCookies } from '@supabase/ssr'
const mocks = vi.hoisted(() => ({ create: vi.fn(), getUser: vi.fn() }))
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.create }))
vi.mock('@/lib/supabase/env', () => ({
  assertPublicSupabaseEnv: () => ({ url: 'http://localhost:54321', anonKey: 'test-key' })
}))
import { middleware } from '@/middleware'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
  mocks.create.mockReturnValue({ auth: { getUser: mocks.getUser } })
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
          async getUser() {
            await options.cookies.setAll([
              { name: 'sb-auth', value: 'refreshed', options: { httpOnly: true, path: '/' } }
            ])
            return { data: { user: { id: 'user' } }, error: null }
          }
        }
      })
    )
    const response = await middleware(request)
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
it('does not use panel-like public prefixes as private routes', async () => {
  await middleware(new NextRequest('https://lysto.test/application'))
  expect(mocks.create).not.toHaveBeenCalled()
})
it('does not cache the closed public receipt or require a user login for it', async () => {
  const response = await middleware(
    new NextRequest('https://lysto.test/comprobante/arbitrary-token')
  )
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(mocks.create).not.toHaveBeenCalled()
})
it('fails closed without disclosing refresh errors', async () => {
  mocks.getUser.mockRejectedValue(new Error('private infrastructure detail'))
  const response = await middleware(new NextRequest('https://lysto.test/app'))
  expect(response.status).toBe(503)
  expect(JSON.stringify(await response.json())).not.toContain('private infrastructure detail')
})
