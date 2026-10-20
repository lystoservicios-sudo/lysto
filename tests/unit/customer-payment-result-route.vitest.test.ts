// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/http/api-error'

const mocks = vi.hoisted(() => ({ session: vi.fn(), read: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({
  requireSession: mocks.session,
  requireRole: async (roles: string[], session: { role: string }) => {
    if (!roles.includes(session.role)) throw new ApiError('forbidden')
    return session
  },
  requireAdminPermission: vi.fn()
}))
vi.mock('@/lib/customer-more/payments', () => ({ readCustomerPaymentResult: mocks.read }))
vi.mock('@/lib/observability/logger', () => ({ logEvent: vi.fn() }))
import { GET } from '@/app/api/customer/payment-result/route'

const id = '8688db78-1b3d-4762-a239-0feb06b2878f'
const request = () => new Request(`https://lysto.test/api/customer/payment-result?checkoutId=${id}&status=approved`)
beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue({ role: 'customer', customerId: 'owner' })
})
it('uses the verified session and exact checkout, never the status in the URL', async () => {
  mocks.read.mockResolvedValue({ id, status: 'pending' })
  const response = await GET(request())
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(await response.json()).toEqual({ id, status: 'pending' })
  expect(mocks.read).toHaveBeenCalledWith({ role: 'customer', customerId: 'owner' }, id)
})
it('requires authentication before looking up financial details', async () => {
  mocks.session.mockRejectedValue(new ApiError('unauthorized'))
  expect((await GET(request())).status).toBe(401)
  expect(mocks.read).not.toHaveBeenCalled()
})
it('denies other roles before querying financial details', async () => {
  mocks.session.mockResolvedValue({ role: 'professional' })
  expect((await GET(request())).status).toBe(403)
  expect(mocks.read).not.toHaveBeenCalled()
})
it('returns the same private response for unknown and other-customer checkouts', async () => {
  mocks.read.mockResolvedValue(null)
  const response = await GET(request())
  expect(response.status).toBe(404)
  expect(await response.json()).toMatchObject({ code: 'not_found' })
})
it('rejects malformed checkout IDs without a database lookup', async () => {
  expect((await GET(new Request('https://lysto.test/api/customer/payment-result?checkoutId=bad'))).status).toBe(400)
  expect(mocks.read).not.toHaveBeenCalled()
})
