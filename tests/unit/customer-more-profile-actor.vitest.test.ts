// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), update: vi.fn(), write: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ requireSession: mocks.session, requireRole: async (_role: unknown, session: unknown) => session }))
vi.mock('@/lib/customer-assets/service', () => ({ readCustomerProfile: vi.fn(), writeCustomerAsset: mocks.write }))
vi.mock('@/lib/security/rate-limit', () => ({ enforceRateLimit: vi.fn(), requestSubject: () => 'test', RateLimitExceeded: class extends Error {} }))
import { PUT } from '@/app/api/customer/profile/route'
import { POST } from '@/app/api/customer/profile/email/route'
const id = '60000000-0000-4000-8000-000000000001'
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lysto.test')
  mocks.session.mockResolvedValue({ role: 'customer', customerId: id, profileId: id, client: { auth: { updateUser: mocks.update } } })
  mocks.update.mockReset(); mocks.write.mockReset()
})
it.each([
  ['PUT', PUT, { firstName: 'Ana', lastName: 'Pérez', phone: '1123456789', notificationPreference: 'email', expectedVersion: 1 }],
  ['POST', POST, { email: 'nuevo@example.com' }]
])('rejects a stale customer tab before the %s profile write', async (method, handler, body) => {
  const response = await handler(new Request('https://lysto.test/api/customer/profile', { method: String(method), headers: { Origin: 'https://lysto.test', 'Content-Type': 'application/json', 'X-Lysto-Customer-Id': '60000000-0000-4000-8000-000000000002' }, body: JSON.stringify(body) }))
  expect(response.status).toBe(403)
  expect(mocks.update).not.toHaveBeenCalled()
  expect(mocks.write).not.toHaveBeenCalled()
})
