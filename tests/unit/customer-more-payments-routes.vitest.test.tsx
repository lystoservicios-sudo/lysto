import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  session: { role: 'customer', customerId: 'fa55ddc2-4ed5-4c39-adf6-c73d95708b95' },
  requirePageSession: vi.fn(), list: vi.fn(), detail: vi.fn(), record: vi.fn(), refund: vi.fn(), notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') })
}))
vi.mock('@/lib/auth/session', () => ({ requirePageSession: m.requirePageSession }))
vi.mock('next/navigation', () => ({ notFound: m.notFound, redirect: vi.fn() }))
vi.mock('@/lib/customer-more/payments', () => ({ listCustomerPayments: m.list, readCustomerPaymentDetail: m.detail, readCustomerPaymentRecord: m.record, readCustomerRefund: m.refund }))
vi.mock('@/components/customer/more-payments/payment-views', () => ({
  CustomerPaymentsList: ({ data }: { data: unknown }) => <div>payment-list:{JSON.stringify(data)}</div>,
  CustomerPaymentDetails: ({ detail, customerId }: { detail: unknown; customerId: string }) => <div>payment-detail:{JSON.stringify(detail)}<span>customer:{customerId}</span></div>,
  CustomerPaymentRecordView: ({ record }: { record: unknown }) => <div>payment-record:{JSON.stringify(record)}</div>,
  CustomerRefundDetails: ({ data }: { data: unknown }) => <div>refund-detail:{JSON.stringify(data)}</div>
}))
import PaymentsPage from '@/app/(customer)/app/pagos/page'
import PaymentDetailPage from '@/app/(customer)/app/pagos/[id]/page'
import PaymentRecordPage from '@/app/(customer)/app/pagos/[id]/comprobante/page'
import RefundPage from '@/app/(customer)/app/pagos/[id]/reintegros/[refundId]/page'

beforeEach(() => { vi.clearAllMocks(); m.requirePageSession.mockResolvedValue(m.session) })
afterEach(cleanup)
describe('connected customer payment routes', () => {
  it('requires the customer session and loads paginated canonical movements, not the owner test widget', async () => {
    m.list.mockResolvedValue({ items: [], total: 0 })
    render(await PaymentsPage({ searchParams: Promise.resolve({ estado: 'pendientes', pagina: '2' }) }))
    expect(m.requirePageSession).toHaveBeenCalledWith('customer')
    expect(m.list).toHaveBeenCalledWith(m.session, { estado: 'pendientes', pagina: '2' })
    expect(screen.getByText(/payment-list:/)).toBeTruthy()
  })
  it('loads payment detail from the owned service', async () => {
    m.detail.mockResolvedValue({ id: 'owned-job' })
    render(await PaymentDetailPage({ params: Promise.resolve({ id: 'owned-job' }) }))
    expect(m.detail).toHaveBeenCalledWith(m.session, 'owned-job')
    expect(screen.getByText(/payment-detail:/)).toBeTruthy()
    expect(screen.getByText(`customer:${m.session.customerId}`)).toBeTruthy()
  })
  it('returns not found for payment details unavailable to the customer', async () => {
    m.detail.mockResolvedValue(null)
    await expect(PaymentDetailPage({ params: Promise.resolve({ id: 'other-job' }) })).rejects.toThrow('NEXT_NOT_FOUND')
  })
  it('loads a guarded canonical payment record with checkout identity', async () => {
    m.record.mockResolvedValue({ checkoutId: 'owned-checkout' })
    render(await PaymentRecordPage({ params: Promise.resolve({ id: 'owned-job' }), searchParams: Promise.resolve({ checkoutId: 'owned-checkout' }) }))
    expect(m.record).toHaveBeenCalledWith(m.session, 'owned-job', 'owned-checkout')
    expect(screen.getByText(/payment-record:/)).toBeTruthy()
  })
  it('does not issue a record for an unconfirmed or unavailable checkout', async () => {
    m.record.mockResolvedValue(null)
    await expect(PaymentRecordPage({ params: Promise.resolve({ id: 'owned-job' }), searchParams: Promise.resolve({ checkoutId: ['tampered'] }) })).rejects.toThrow('NEXT_NOT_FOUND')
  })
  it('loads only the actual owned refund request', async () => {
    m.refund.mockResolvedValue({ refund: { id: 'owned-refund' } })
    render(await RefundPage({ params: Promise.resolve({ id: 'owned-job', refundId: 'owned-refund' }) }))
    expect(m.refund).toHaveBeenCalledWith(m.session, 'owned-job', 'owned-refund')
    expect(screen.getByText(/refund-detail:/)).toBeTruthy()
  })
  it('hides another customers refund details with not found', async () => {
    m.refund.mockResolvedValue(null)
    await expect(RefundPage({ params: Promise.resolve({ id: 'owned-job', refundId: 'other-refund' }) })).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
