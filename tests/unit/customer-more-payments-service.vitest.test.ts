import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@/lib/auth/session'

const { query } = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@/lib/payments/marketplace-db', () => ({ paymentDatabase: () => ({ query }) }))
import { countPendingCustomerPayments, listCustomerPayments, readCustomerPaymentDetail, readCustomerPaymentRecord, readCustomerRefund, readCustomerPaymentResult } from '@/lib/customer-more/payments'

const customerId = 'fa55ddc2-4ed5-4c39-adf6-c73d95708b95'
const jobId = 'd046d214-fb6d-48ab-81c0-7a7f0e630d48'
const checkoutId = 'ab8fc712-1cb5-49c3-9676-c37fd95793ab'
const session = { role: 'customer', customerId } as Session
const detail = {
  id: jobId, status: 'confirmed', service: 'Mantenimiento preventivo', professional: 'Walter G.',
  amount: 1000, scheduledDate: '2026-10-16', timeWindow: '09:00-12:00', createdAt: '2026-10-14T18:00:00Z',
  extras: [{ id: '725358cf-fd0a-4d8b-8ab3-abdf7372b26e', fault: 'Limpieza adicional', amount: 500, status: 'accepted' }],
  checkouts: [{ id: checkoutId, extraId: null, extraLabel: null, amount: 1000, currency: 'ARS', status: 'approved',
    liveMode: true, createdAt: '2026-10-14T18:00:00Z', updatedAt: '2026-10-14T18:30:00Z', expiresAt: '2026-10-15T18:00:00Z',
    refundedAmount: 0, providerReferences: ['123456'], refunds: [] }],
  serviceReceipt: { token: 'b3dc0cbd-b265-4e37-b5c0-21f58025a7b7' }
}
beforeEach(() => query.mockReset())

it('reads the exact owned payment result and its canonical references', async () => {
  query.mockResolvedValueOnce({ rows: [{ job_id: jobId, marketplace_fee: '180.00' }] })
    .mockResolvedValueOnce({ rows: [{ data: detail }] })
  expect(await readCustomerPaymentResult(session, checkoutId)).toMatchObject({
    id: checkoutId, jobId, amount: 1000, lystoFee: 180, status: 'approved',
    service: 'Mantenimiento preventivo', professional: 'Walter G.', providerReferences: ['123456']
  })
  expect(query.mock.calls[0][1]).toEqual([customerId, checkoutId])
  expect(query.mock.calls[0][0]).toContain('customer_id=$1::uuid')
})
it('does not look up a payment result without customer authority or a valid ID', async () => {
  await expect(readCustomerPaymentResult({ role: 'professional' } as Session, checkoutId))
    .rejects.toMatchObject({ code: 'forbidden' })
  expect(await readCustomerPaymentResult(session, 'invalid')).toBeNull()
  expect(query).not.toHaveBeenCalled()
})
it('does not reveal another customer checkout or fall back to another payment in the job', async () => {
  query.mockResolvedValueOnce({ rows: [] })
  expect(await readCustomerPaymentResult(session, checkoutId)).toBeNull()
  expect(query).toHaveBeenCalledTimes(1)
  query.mockResolvedValueOnce({ rows: [{ job_id: jobId, marketplace_fee: '0' }] })
    .mockResolvedValueOnce({ rows: [{ data: { ...detail, checkouts: [] } }] })
  expect(await readCustomerPaymentResult(session, checkoutId)).toBeNull()
})
describe('customer payment read boundaries', () => {
  it('rejects noncustomers and missing customer authority before opening the database', async () => {
    for (const value of [{ role: 'admin', customerId }, { role: 'customer' }]) {
      await expect(listCustomerPayments(value as Session)).rejects.toMatchObject({ code: 'forbidden' })
      await expect(readCustomerPaymentDetail(value as Session, jobId)).rejects.toMatchObject({ code: 'forbidden' })
    }
    expect(query).not.toHaveBeenCalled()
  })

  it('paginates with bound inputs and an explicit owner predicate, never a provider call', async () => {
    query.mockResolvedValue({ rows: [{ data: { items: [], total: 45 } }] })
    const page = await listCustomerPayments(session, { estado: 'pendientes', pagina: '2' })
    expect(page).toMatchObject({ items: [], total: 45, page: 2, hasNext: true, hasPrevious: true })
    expect(query.mock.calls[0][1]).toEqual([customerId, 'pendientes', 20, 20])
    expect(query.mock.calls[0][0]).toContain('j.customer_id=$1::uuid')
    expect(query.mock.calls[0][0]).not.toMatch(/select\s+\*|update\s|insert\s|delete\s/i)
  })

  it('excludes historical retries when the same payment target is paid, processing, refunded or in review', async () => {
    query.mockResolvedValue({ rows: [{ data: { items: [], total: 0 } }] })
    await listCustomerPayments(session, { estado: 'pendientes' })
    const sql = query.mock.calls[0][0] as string
    const pending = sql.slice(sql.indexOf("or ($2='pendientes'"), sql.indexOf("or ($2='procesando'"))
    expect(pending).toContain('not exists')
    expect(pending).toContain('settled.job_id=m.job_id')
    expect(pending).toContain('settled.extra_id is not distinct from m.extra_id')
    expect(pending).toContain('settled.customer_id=$1::uuid')
    expect(pending).toContain("'approved','pending','in_process','review','refunded','partially_refunded','charged_back'")
  })

  it('returns not found without querying malformed job IDs', async () => {
    expect(await readCustomerPaymentDetail(session, '../other-user')).toBeNull()
    expect(query).not.toHaveBeenCalled()
  })

  it('returns owned canonical details and binds ownership in private refund and observation reads', async () => {
    query.mockResolvedValue({ rows: [{ data: detail }] })
    const result = await readCustomerPaymentDetail(session, jobId)
    expect(result).toEqual(detail)
    expect(query.mock.calls[0][1]).toEqual([customerId, jobId])
    expect(query.mock.calls[0][0]).toContain('j.customer_id=$1::uuid')
    expect(query.mock.calls[0][0]).toContain('c.customer_id=$1::uuid')
    expect(query.mock.calls[0][0]).toContain('p.customer_id=$1::uuid')
    expect(query.mock.calls[0][0]).toContain("o.provider_status in ('approved','refunded','partially_refunded')")
    expect(query.mock.calls[0][0]).not.toMatch(/encrypted_|access_token|seller_account_id|preference_spec|review_reason/)
  })

  it('does not reveal nonexistent or other-customer jobs', async () => {
    query.mockResolvedValue({ rows: [] })
    expect(await readCustomerPaymentDetail(session, jobId)).toBeNull()
    expect(await readCustomerPaymentRecord(session, jobId, checkoutId)).toBeNull()
    expect(await readCustomerRefund(session, jobId, checkoutId)).toBeNull()
  })

  it('rejects receipt access for pending, test, or mismatched checkout records', async () => {
    for (const patch of [{ status: 'pending' }, { liveMode: false }, { providerReferences: [] }]) {
      query.mockResolvedValue({ rows: [{ data: { ...detail, checkouts: [{ ...detail.checkouts[0], ...patch }] } }] })
      expect(await readCustomerPaymentRecord(session, jobId, checkoutId)).toBeNull()
    }
    query.mockResolvedValue({ rows: [{ data: detail }] })
    expect(await readCustomerPaymentRecord(session, jobId, 'ce33d44b-c6f0-4e41-88e2-dc21e189139a')).toBeNull()
    expect(await readCustomerPaymentRecord(session, jobId, checkoutId)).toMatchObject({ jobId, checkoutId, amount: 1000, service: 'Mantenimiento preventivo' })
  })

  it('reads a real refund case without granting the customer approval or execution', async () => {
    const refund = { id: '8809814b-75b9-42fc-8bbc-f65eeab98a6e', amount: 100, status: 'requested', reason: 'Solicitud de reintegro por cancelación', requestedAt: '2026-10-14T18:30:00Z', updatedAt: '2026-10-14T18:30:00Z', providerReference: null }
    query.mockResolvedValue({ rows: [{ data: { ...detail, checkouts: [{ ...detail.checkouts[0], refunds: [refund] }] } }] })
    expect(await readCustomerRefund(session, jobId, refund.id)).toMatchObject({ refund, jobId, service: detail.service })
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('counts actual unpaid targets, not provider pending confirmations, and guards authority', async () => {
    query.mockResolvedValue({ rows: [{ count: '3' }] })
    expect(await countPendingCustomerPayments(session)).toBe(3)
    expect(query.mock.calls[0][1]).toEqual([customerId])
    expect(query.mock.calls[0][0]).toContain('accepted')
    expect(query.mock.calls[0][0]).toContain('in_process')
    await expect(countPendingCustomerPayments({ role: 'professional' } as Session)).rejects.toMatchObject({ code: 'forbidden' })
  })
})
