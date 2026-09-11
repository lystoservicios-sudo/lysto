// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), query: vi.fn() }))
vi.mock('@/lib/pricing/server', () => ({ getPricingSession: mocks.session }))
vi.mock('@/lib/payments/marketplace-db', () => ({ paymentDatabase: () => ({ query: mocks.query }) }))
import { paymentActor, visibleCheckout, type PaymentActor } from '@/lib/payments/marketplace-session'

beforeEach(() => { vi.clearAllMocks() })
function actor(role: 'customer' | 'professional' | 'admin', permissions: string[] = []) {
  return { role, userId: 'trusted-user', profileId: 'trusted-profile', permissions,
    customerId: role === 'customer' ? 'customer-a' : undefined,
    professionalId: role === 'professional' ? 'professional-a' : undefined } as PaymentActor
}
it('denies operations administrators before accessing the payment database', async () => {
  mocks.session.mockResolvedValue(actor('admin', ['operations']))
  await expect(paymentActor()).rejects.toMatchObject({ status: 403 })
  expect(mocks.query).not.toHaveBeenCalled()
})
it.each(['finance', 'owner'])('accepts current %s authority for administrative payments', async permission => {
  mocks.session.mockResolvedValue(actor('admin', [permission]))
  await expect(paymentActor()).resolves.toMatchObject({ role: 'admin', permissions: [permission] })
})
it.each(['customer', 'professional'] as const)('allows a %s to read their own checkout only', async role => {
  const own = { id: 'checkout', customer_id: 'customer-a', professional_id: 'professional-a' }
  mocks.query.mockResolvedValue({ rows: [own] })
  expect(await visibleCheckout('checkout', actor(role))).toBe(own)
  mocks.query.mockResolvedValue({ rows: [{ ...own, customer_id: 'customer-b', professional_id: 'professional-b' }] })
  await expect(visibleCheckout('checkout', actor(role))).rejects.toMatchObject({ status: 404, code: 'not_found' })
  mocks.query.mockResolvedValue({ rows: [] })
  await expect(visibleCheckout('missing', actor(role))).rejects.toMatchObject({ status: 404, code: 'not_found' })
})
