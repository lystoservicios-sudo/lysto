import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), travel: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/pricing/server', async () => ({
  ...(await vi.importActual<typeof import('@/lib/pricing/server')>('@/lib/pricing/server')),
  getPricingSession: mocks.session
}))
vi.mock('@/lib/pricing/travel', () => ({ estimateTravel: mocks.travel }))
import { POST } from '@/app/api/pricing/quote/route'
afterEach(() => vi.useRealTimers())
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost')
})
it('requires an authenticated user before calculating or calling a paid provider', async () => {
  mocks.session.mockRejectedValue(new Error('unauthorized'))
  const result = await POST(
    new Request('http://localhost/api/pricing/quote', { method: 'POST', body: '{}' })
  )
  expect(result.status).toBe(401)
  expect(mocks.travel).not.toHaveBeenCalled()
})
it('also rejects short-notice customer requests through the older quote endpoint', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-25T15:00:00Z'))
  mocks.session.mockResolvedValue({ role: 'customer', profileId: 'customer', client: { rpc: mocks.rpc }, customerId: 'id' })
  const result = await POST(new Request('http://localhost/api/pricing/quote', {
    method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json' },
    body: JSON.stringify({ issue: 'no_enfria', urgency: 'flexible', propertyType: 'house', access: {},
      address: { street: 'Prueba', number: '123', city: 'CABA', province: 'CABA' },
      preferredDate: '2026-10-27', timeWindow: '10:00 – 12:00' })
  }))
  expect(result.status).toBe(400)
  expect(await result.json()).toMatchObject({ code: 'booking_notice_required', error: expect.stringContaining('3 días hábiles') })
  expect(mocks.travel).not.toHaveBeenCalled()
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('rejects client-supplied money, route overrides and markup', async () => {
  mocks.session.mockResolvedValue({
    role: 'customer',
    client: { rpc: mocks.rpc },
    customerId: 'id'
  })
  const result = await POST(
    new Request('http://localhost/api/pricing/quote', {
      method: 'POST',
      headers: { Origin: 'http://localhost', 'Content-Type': 'application/json' },
      body: JSON.stringify({ total: 1, route: {}, safetyRate: 0 })
    })
  )
  expect(result.status).toBe(400)
  expect(mocks.travel).not.toHaveBeenCalled()
})
