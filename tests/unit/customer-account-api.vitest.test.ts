import { beforeEach, expect, it, vi } from 'vitest'
import { GET as GET_PREFERENCES, PUT } from '@/app/api/customer/preferences/route'
import { GET as GET_SESSIONS, POST as POST_SESSIONS } from '@/app/api/customer/account/sessions/route'
import { GET as GET_PRIVACY, POST as POST_PRIVACY } from '@/app/api/customer/account/privacy/route'
import { POST as POST_PASSWORD } from '@/app/api/customer/account/password/route'
import { GET as GET_EXPORT } from '@/app/api/customer/account/export/route'
import { createClient } from '@supabase/supabase-js'
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))

const state = vi.hoisted(() => ({ role: 'customer', rpc: vi.fn(), getUser: vi.fn(), updateUser: vi.fn() }))
vi.mock('@/lib/auth/session', async actualImport => {
  const actual = await actualImport<typeof import('@/lib/auth/session')>()
  return { ...actual, requireSession: async () => ({ role: state.role, profileId: id(1), customerId: id(2), userId: id(3), sessionId: id(4), client: { rpc: state.rpc, auth: { getUser: state.getUser, updateUser: state.updateUser } } }) }
})
vi.mock('@/lib/observability/logger', () => ({ logEvent: vi.fn() }))
function id(n: number) { return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` }
const preferences = { version: 0, emailMaintenance: true, emailSupportUpdates: true, marketingEmail: false, reduceMotion: false }
function request(path: string, method: string, body?: unknown, actor: string | null = id(2), origin = 'http://localhost:3100') {
  return new Request(`http://localhost:3100${path}`, { method, headers: { origin, 'content-type': 'application/json', ...(actor ? { 'X-Lysto-Customer-Id': actor } : {}) }, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) })
}
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3100'); vi.stubEnv('RATE_LIMIT_HASH_KEY', '')
  state.role = 'customer'; state.rpc.mockReset(); state.getUser.mockReset(); state.updateUser.mockReset()
  state.rpc.mockResolvedValue({ data: { preferences, essentialEmail: true }, error: null })
  state.getUser.mockResolvedValue({ data: { user: { id: id(3), email: 'a@lysto.test', app_metadata: { app_role: 'customer' } } }, error: null })
  state.updateUser.mockResolvedValue({ data: {}, error: null })
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://lysto-test.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-anon')
  vi.mocked(createClient).mockReset().mockReturnValue({ auth: {
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: id(3), app_metadata: { app_role: 'customer' } }, session: { access_token: 'transient' } }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null })
  } } as never)
})
const mutations = [
  ['/api/customer/preferences', PUT, 'PUT'], ['/api/customer/account/sessions', POST_SESSIONS, 'POST'],
  ['/api/customer/account/privacy', POST_PRIVACY, 'POST'], ['/api/customer/account/password', POST_PASSWORD, 'POST']
] as const
it.each(mutations)('%s rejects stale/missing actors before reading a malformed body', async (path, handle, method) => {
  for (const actor of [null, 'invalid-uuid', id(9)]) {
    const input = request(path, method, '{broken', actor)
    const reader = vi.spyOn(input.body!, 'getReader')
    expect((await handle(input)).status).toBe(403)
    expect(reader).not.toHaveBeenCalled(); expect(state.rpc).not.toHaveBeenCalled(); expect(state.getUser).not.toHaveBeenCalled()
  }
})
it.each(mutations)('%s rejects cross-site origins without a domain or Auth write', async (path, handle, method) => {
  expect((await handle(request(path, method, {}, id(2), 'https://evil.invalid'))).status).toBe(403)
  expect(state.rpc).not.toHaveBeenCalled(); expect(state.getUser).not.toHaveBeenCalled()
})
it('reads and writes persisted preferences with private cache headers', async () => {
  const get = await GET_PREFERENCES(request('/api/customer/preferences', 'GET'))
  expect(get.status).toBe(200); expect(get.headers.get('cache-control')).toContain('no-store')
  expect(await get.json()).toEqual({ preferences, essentialEmail: true })
  expect((await PUT(request('/api/customer/preferences', 'PUT', preferences))).status).toBe(200)
})
it('returns sanitized sessions and persisted privacy status to the own customer', async () => {
  state.rpc.mockResolvedValueOnce({ data: [{ id: id(4), current: true, createdAt: '2026-10-14', lastSeenAt: null, device: 'Chrome', ip: 'secret' }], error: null })
  const sessions = await GET_SESSIONS(request('/api/customer/account/sessions', 'GET'))
  expect(sessions.status).toBe(200); expect(JSON.stringify(await sessions.json())).not.toContain('secret')
  const privacy = { request: null, pending: { jobs: 0, payments: 0 } }
  state.rpc.mockResolvedValueOnce({ data: privacy, error: null })
  expect(await (await GET_PRIVACY(request('/api/customer/account/privacy', 'GET'))).json()).toEqual(privacy)
})
it('sends current password to Auth and never accepts an ownership parameter', async () => {
  const input = { currentPassword: 'Old123', newPassword: 'Nueva123', confirmPassword: 'Nueva123' }
  expect((await POST_PASSWORD(request('/api/customer/account/password', 'POST', input))).status).toBe(200)
  expect(state.updateUser).toHaveBeenCalledWith({ password: 'Nueva123', current_password: 'Old123' })
  expect((await POST_PASSWORD(request('/api/customer/account/password', 'POST', { ...input, userId: id(9) }))).status).toBe(400)
})
it('bounds streamed JSON bytes and rejects unexpected preference fields', async () => {
  expect((await PUT(request('/api/customer/preferences', 'PUT', { ...preferences, essentialEmail: false }))).status).toBe(400)
  expect((await PUT(request('/api/customer/preferences', 'PUT', JSON.stringify({ value: 'x'.repeat(9000) })))).status).toBe(400)
  expect(state.rpc).not.toHaveBeenCalled()
})
it('provides a real JSON attachment, not a public link or HTML error download', async () => {
  const rows = { schemaVersion: 1, exportedAt: '2026-10-14', profile: {}, addresses: [], homes: [], equipment: [], serviceRequests: [], requestAnswers: [], jobs: [], payments: [], serviceReports: [], warrantyClaims: [], maintenancePlans: [], supportCases: [], reviews: [], preferences, privacyRequests: [] }
  state.rpc.mockResolvedValue({ data: rows, error: null })
  const response = await GET_EXPORT(request('/api/customer/account/export', 'GET'))
  expect(response.status).toBe(200); expect(response.headers.get('content-disposition')).toContain('attachment')
  expect(response.headers.get('cache-control')).toContain('no-store'); expect(await response.json()).toEqual(rows)
})
it('rejects professional sessions on every endpoint', async () => {
  state.role = 'professional'
  for (const handle of [GET_PREFERENCES, GET_SESSIONS, GET_PRIVACY, GET_EXPORT]) expect((await handle(request('/api/customer/account', 'GET'))).status).toBe(403)
  expect(state.rpc).not.toHaveBeenCalled()
})
