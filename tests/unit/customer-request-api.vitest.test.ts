import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as preview } from '@/app/api/customer/requests/preview/route'
import { POST as prepare } from '@/app/api/customer/requests/prepare/route'
const state = vi.hoisted(() => ({ role: 'customer', preview: vi.fn(), prepare: vi.fn() }))
vi.mock('@/lib/auth/session', async importActual => {
  const actual = await importActual<typeof import('@/lib/auth/session')>()
  return { ...actual, requireSession: async () => ({ role: state.role, profileId: '00000000-0000-4000-8000-000000000001', customerId: '00000000-0000-4000-8000-000000000002', userId: '00000000-0000-4000-8000-000000000003', sessionId: '00000000-0000-4000-8000-000000000004' }) }
})
vi.mock('@/lib/customer-requests/service', () => ({ customerRequestService: { preview: state.preview, prepare: state.prepare } }))
vi.mock('@/lib/observability/logger', () => ({ logEvent: vi.fn() }))
const actor = '00000000-0000-4000-8000-000000000002'
function request(path: string, body = '{}', customerId: string | null = actor, origin: string | null = 'http://localhost:3100', internalOrigin = 'http://localhost:3100') {
  return new Request(`${internalOrigin}${path}`, { method: 'POST', body,
    headers: { 'Content-Type': 'application/json', ...(customerId ? { 'X-Lysto-Customer-Id': customerId } : {}), ...(origin ? { origin } : {}) } })
}
beforeEach(() => {
  state.role = 'customer'
  state.preview.mockReset().mockResolvedValue({ status: 'needs_review', reason: 'tariffs_unapproved' })
  state.prepare.mockReset().mockResolvedValue({ status: 'unavailable', reason: 'no_available_professional' })
  vi.stubEnv('RATE_LIMIT_HASH_KEY', '')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3100')
  vi.stubEnv('APP_ENV', 'test')
  vi.stubEnv('PAYMENTS_PROVIDER', 'mercadopago_split')
  vi.stubEnv('LYSTO_ACCEPT_NEW_REQUESTS', 'true')
  vi.stubEnv('LYSTO_ALLOW_NEW_CHECKOUTS', 'true')
})
afterEach(() => vi.unstubAllEnvs())
describe.each([
  ['/api/customer/requests/preview', preview, state.preview],
  ['/api/customer/requests/prepare', prepare, state.prepare]
] as const)('%s authenticated HTTP boundary', (path, handler, service) => {
  it('rejects missing, malformed or stale-account actor before reading the body', async () => {
    for (const expected of [null, 'invalid', '00000000-0000-4000-8000-000000000005']) {
      const value = request(path, '{broken', expected)
      const read = vi.spyOn(value.body!, 'getReader')
      expect((await handler(value)).status).toBe(403)
      expect(read).not.toHaveBeenCalled()
      expect(service).not.toHaveBeenCalled()
    }
  })
  it('rejects another role before reading customer data', async () => {
    state.role = 'professional'
    const value = request(path, '{broken')
    const read = vi.spyOn(value.body!, 'getReader')
    expect((await handler(value)).status).toBe(403)
    expect(read).not.toHaveBeenCalled()
    expect(service).not.toHaveBeenCalled()
  })
  it('rejects missing or cross-origin mutations before reading the body', async () => {
    for (const origin of [null, 'https://other.example']) {
      const value = request(path, '{broken', actor, origin)
      const read = vi.spyOn(value.body!, 'getReader')
      expect((await handler(value)).status).toBe(403)
      expect(read).not.toHaveBeenCalled()
      expect(service).not.toHaveBeenCalled()
    }
  })
  it('keeps the result private and passes authority only from the session', async () => {
    const value = { marker: 'boundary-only-fixture' }
    const response = await handler(request(path, JSON.stringify(value)))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(service).toHaveBeenCalledWith(expect.objectContaining({ customerId: actor, role: 'customer' }), value)
    expect(await response.json()).toMatchObject({ status: expect.stringMatching(/needs_review|unavailable/) })
  })
  it('accepts only the configured public origin even when the server request URL has an internal host', async () => {
    const publicOrigin = 'http://127.0.0.1:3175'
    vi.stubEnv('NEXT_PUBLIC_APP_URL', publicOrigin)
    const value = { marker: 'canonical-origin-boundary-only-fixture' }
    const input = request(path, JSON.stringify(value), actor, publicOrigin, 'http://localhost:3175')
    const read = vi.spyOn(input.body!, 'getReader')
    const response = await handler(input)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(read).toHaveBeenCalledOnce()
    expect(service).toHaveBeenCalledWith(expect.objectContaining({ customerId: actor, role: 'customer' }), value)
  })
  it('rejects a spoofed origin matching the internal request host but not the configured public origin before body access', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://127.0.0.1:3175')
    const input = request(path, '{broken', actor, 'https://foreign.invalid', 'https://foreign.invalid')
    const read = vi.spyOn(input.body!, 'getReader')
    const response = await handler(input)
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'forbidden' })
    expect(read).not.toHaveBeenCalled()
    expect(service).not.toHaveBeenCalled()
  })
  it('rejects malformed and oversized bodies before preparing a contract', async () => {
    for (const body of ['{broken', JSON.stringify({ excess: 'x'.repeat(140000) })]) {
      const response = await handler(request(path, body))
      expect(response.status).toBe(400)
      expect(service).not.toHaveBeenCalled()
    }
  })
  it('respects closed intake without any service/provider preparation', async () => {
    vi.stubEnv('LYSTO_ACCEPT_NEW_REQUESTS', 'false')
    expect((await handler(request(path))).status).toBeGreaterThanOrEqual(400)
    expect(service).not.toHaveBeenCalled()
  })
})
it('closed checkout intake blocks preparation but not the read-only price preview', async () => {
  vi.stubEnv('LYSTO_ALLOW_NEW_CHECKOUTS', 'false')
  expect((await prepare(request('/api/customer/requests/prepare'))).status).toBeGreaterThanOrEqual(400)
  expect(state.prepare).not.toHaveBeenCalled()
  expect((await preview(request('/api/customer/requests/preview'))).status).toBe(200)
})
