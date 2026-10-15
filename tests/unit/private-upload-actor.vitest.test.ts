import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as sign } from '@/app/api/uploads/sign/route'
import { POST as finalize } from '@/app/api/uploads/finalize/route'
const state = vi.hoisted(() => ({ sign: vi.fn(), finalize: vi.fn(), body: vi.fn(), role: 'customer' }))
vi.mock('@/lib/auth/session', async importActual => ({ ...await importActual<typeof import('@/lib/auth/session')>(), requireSession: async () => ({ role: state.role, profileId: '75000000-0000-4000-8000-000000000001', customerId: state.role === 'customer' ? '75000000-0000-4000-8000-000000000010' : undefined }) }))
vi.mock('@/lib/uploads/service', () => ({ signUpload: state.sign, finalizeUpload: state.finalize, readUploadBody: state.body }))
vi.mock('@/lib/observability/logger', () => ({ logEvent: vi.fn() }))
beforeEach(() => { vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3100'); vi.stubEnv('RATE_LIMIT_HASH_KEY', ''); state.role = 'customer'; vi.clearAllMocks(); state.sign.mockResolvedValue({ signed: true }); state.finalize.mockResolvedValue({ verified: true }); state.body.mockResolvedValue({ kind: 'request-photo' }) })
afterEach(() => vi.unstubAllEnvs())
function request(actor?: string) { return new Request('http://localhost:3100/api/uploads/sign', { method: 'POST', headers: { origin: 'http://localhost:3100', 'Content-Type': 'application/json', ...(actor ? { 'X-Lysto-Customer-Id': actor } : {}) }, body: '{}' }) }
describe('upload originating customer precondition', () => {
  it.each([['sign', sign], ['finalize', finalize]] as const)('%s rejects a changed actor before reading or mutating private media', async (_name, handler) => {
    expect((await handler(request('75000000-0000-4000-8000-000000000011'))).status).toBe(403)
    expect(state.body).not.toHaveBeenCalled(); expect(state.sign).not.toHaveBeenCalled(); expect(state.finalize).not.toHaveBeenCalled()
  })
  it('accepts the matching expected customer without making header identity into ownership', async () => {
    expect((await sign(request('75000000-0000-4000-8000-000000000010'))).status).toBe(200)
    expect(state.sign).toHaveBeenCalledWith(expect.objectContaining({ customerId: '75000000-0000-4000-8000-000000000010' }), { kind: 'request-photo' })
  })
  it('preserves professional upload callers that do not send a customer precondition', async () => {
    state.role = 'professional'
    expect((await sign(request())).status).toBe(200)
  })
})
