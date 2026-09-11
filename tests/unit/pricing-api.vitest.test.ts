import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), travel: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/pricing/server', async () => ({ ...(await vi.importActual<typeof import('@/lib/pricing/server')>('@/lib/pricing/server')), getPricingSession: mocks.session }))
vi.mock('@/lib/pricing/google-routes', () => ({ estimateTravel: mocks.travel }))
import { POST } from '@/app/api/pricing/quote/route'
beforeEach(() => { vi.clearAllMocks() })
it('requires an authenticated user before calculating or calling a paid provider', async () => {
  mocks.session.mockRejectedValue(new Error('unauthorized'))
  const result = await POST(new Request('http://localhost/api/pricing/quote', { method: 'POST', body: '{}' }))
  expect(result.status).toBe(401)
  expect(mocks.travel).not.toHaveBeenCalled()
})
it('rejects client-supplied money, route overrides and markup', async () => {
  mocks.session.mockResolvedValue({ role: 'customer', client: { rpc: mocks.rpc }, customerId: 'id' })
  const result = await POST(new Request('http://localhost/api/pricing/quote', { method: 'POST', body: JSON.stringify({ total: 1, route: {}, safetyRate: 0 }) }))
  expect(result.status).toBe(400)
  expect(mocks.travel).not.toHaveBeenCalled()
})
