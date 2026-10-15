import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/http/api-error'
const m = vi.hoisted(() => ({
  session: { role: 'customer', customerId: 'fa55ddc2-4ed5-4c39-adf6-c73d95708b95' }, read: vi.fn(), requireSession: vi.fn(), requireRole: vi.fn()
}))
vi.mock('@/lib/auth/session', () => ({ requireSession: m.requireSession, requireRole: m.requireRole, requireAdminPermission: vi.fn() }))
vi.mock('@/lib/customer-more/payments', () => ({ readCustomerPaymentRecord: m.read }))
vi.mock('@/lib/observability/logger', () => ({ logEvent: vi.fn() }))
import { GET } from '@/app/api/customer/payments/[id]/record/route'
const jobId = 'd046d214-fb6d-48ab-81c0-7a7f0e630d48'
const checkoutId = 'ab8fc712-1cb5-49c3-9676-c37fd95793ab'
const request = () => new Request(`https://lystohogar.com/api/customer/payments/${jobId}/record?checkoutId=${checkoutId}`)
beforeEach(() => { vi.clearAllMocks(); m.requireSession.mockResolvedValue(m.session); m.requireRole.mockResolvedValue(m.session) })
describe('guarded non-fiscal payment download', () => {
  it('authenticates a customer and returns a private text attachment from confirmed canonical data', async () => {
    m.read.mockResolvedValue({ jobId, checkoutId, service: 'Mantenimiento', amount: 1000, refundedAmount: 0, status: 'approved',
      createdAt: '2026-10-14T18:00:00Z', updatedAt: '2026-10-14T18:00:00Z', providerReferences: ['123456'], extraLabel: null })
    const response = await GET(request(), { params: Promise.resolve({ id: jobId }) })
    expect(response.status).toBe(200)
    expect(m.requireRole).toHaveBeenCalledWith(['customer'], m.session)
    expect(m.read).toHaveBeenCalledWith(m.session, jobId, checkoutId)
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(response.headers.get('Content-Type')).toContain('text/plain')
    expect(response.headers.get('Content-Disposition')).toContain(`attachment; filename="lysto-pago-${checkoutId}.txt"`)
    expect(await response.text()).toContain('No es una factura fiscal')
  })
  it('does not download an unavailable, pending or other-customer record', async () => {
    m.read.mockResolvedValue(null)
    expect((await GET(request(), { params: Promise.resolve({ id: jobId }) })).status).toBe(404)
  })
  it('rejects anonymous access before reading financial data', async () => {
    m.requireSession.mockRejectedValue(new ApiError('unauthorized'))
    expect((await GET(request(), { params: Promise.resolve({ id: jobId }) })).status).toBe(401)
    expect(m.read).not.toHaveBeenCalled()
  })
})
