// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CheckoutRow } from '@/lib/payments/marketplace-db'

const boundary = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@/lib/payments/marketplace-db', () => ({
  paymentTransaction: async (work: (db: { query: typeof boundary.query }) => Promise<unknown>) => work({ query: boundary.query }),
  paymentDatabase: () => ({ query: boundary.query })
}))
import { applyCanonicalOrder, applyCanonicalPayment } from '@/lib/payments/marketplace-ledger'

const checkout: CheckoutRow = {
  id: '11111111-1111-4111-8111-111111111111', job_id: '22222222-2222-4222-8222-222222222222',
  extra_id: null, customer_id: '33333333-3333-4333-8333-333333333333',
  professional_id: '44444444-4444-4444-8444-444444444444', seller_account_id: '1234',
  amount: '100.00', marketplace_fee: '18.00', professional_amount: '82.00', live_mode: false,
  status: 'ready', checkout_protocol: 'preferences', preference_id: 'pref-1', order_id: null,
  order_idempotency_key: '55555555-5555-4555-8555-555555555555', checkout_url: null,
  init_point: null, sandbox_init_point: null, expires_at: new Date('2026-09-20T12:30:00Z'),
  created_at: new Date('2026-09-20T12:00:00Z'), lease_until: null, lease_token: null,
  review_reason: null, closed_for_new_payments_at: null, last_error: null
}
const job = { id: checkout.job_id, professional_id: checkout.professional_id, status: 'confirmed', request_id: 'request-1' }
const payment = { id: 444, collector_id: 1234, external_reference: checkout.id, currency_id: 'ARS',
  transaction_amount: 100, transaction_amount_refunded: 0, live_mode: false, status: 'approved',
  date_last_updated: '2026-09-20T12:10:00Z', fee_details: [{ type: 'application_fee', amount: 18 }, { type: 'mercadopago_fee', amount: 6 }],
  transaction_details: { net_received_amount: 76 } }
const order = { id: 'ORDTST01ABC', type: 'online', processing_mode: 'manual', external_reference: checkout.id,
  total_amount: '100.00', marketplace_fee: '18.00', currency: 'ARS', user_id: '1234', status: 'processed',
  status_detail: 'accredited', total_paid_amount: '100.00', last_updated_date: '2026-09-20T12:10:00Z',
  transactions: { payments: [{ id: 'PAY01ABC', amount: '100.00', paid_amount: '100.00', status: 'processed', status_detail: 'accredited' }], refunds: [], chargebacks: [] } }

function database(protocol: 'preferences' | 'orders', persistedStatus: string | null = 'review', options: { changedOwner?: 'job_id' | 'customer_id' | 'professional_id'; missingParent?: 'customer' | 'professional' } = {}) {
  const current = protocol === 'orders' ? { ...checkout, checkout_protocol: protocol, preference_id: null, order_id: order.id } : checkout
  boundary.query.mockImplementation(async (query: string) => {
    const sql = query.replace(/\s+/g, ' ').trim().toLowerCase()
    if (sql.startsWith('select job_id')) return { rows: [{ job_id: checkout.job_id, customer_id: checkout.customer_id, professional_id: checkout.professional_id }], rowCount: 1 }
    if (sql.startsWith('select * from public.marketplace_checkouts')) return { rows: [{ ...current, ...(options.changedOwner ? { [options.changedOwner]: 'another-owner' } : {}) }], rowCount: 1 }
    if (sql.includes('from public.customer_profiles')) return { rows: options.missingParent === 'customer' ? [] : [{ id: checkout.customer_id }] }
    if (sql.includes('from public.professional_profiles')) return { rows: options.missingParent === 'professional' ? [] : [{ id: checkout.professional_id }] }
    if (sql.includes('from public.jobs where id=$1')) return { rows: [job], rowCount: 1 }
    if (sql.startsWith('insert into private.marketplace_applied_events')) return { rows: [{ event_id: 'evt-1' }], rowCount: 1 }
    if (sql.includes('from private.marketplace_order_observations') || sql.startsWith('select checkout_id,provider_updated_at')) return { rows: [], rowCount: 0 }
    if (sql.startsWith('select provider_status,issues from public.marketplace_payment_observations')) return { rows: [{ provider_status: 'approved', issues: [] }], rowCount: 1 }
    if (sql.startsWith('insert into private.marketplace_order_observations') || sql.startsWith('insert into public.marketplace_payment_observations') || sql.startsWith('insert into public.payment_events')) return { rows: [], rowCount: 1 }
    if (sql.startsWith('update public.marketplace_checkouts set status=')) return { rows: sql.includes('returning status') && persistedStatus ? [{ status: persistedStatus }] : [], rowCount: persistedStatus ? 1 : 0 }
    if (sql.startsWith('insert into public.payments')) return { rows: [{ id: 'payment-projection-1' }], rowCount: 1 }
    throw new Error(`Unexpected database query: ${sql}`)
  })
}

beforeEach(() => vi.clearAllMocks())
describe.each([
  ['preferences', applyCanonicalPayment, payment],
  ['orders', applyCanonicalOrder, order]
] as const)('%s canonical checkout', (protocol, apply, raw) => {
  it('returns the persisted review state rather than announcing an expired contract as approved', async () => {
    database(protocol)
    expect(await apply(checkout.id, raw, 'evt-1')).toEqual({ status: 'review' })
    // The financial ledger still records received funds accurately, even when the visit needs review.
    expect(boundary.query.mock.calls.find(([sql]) => String(sql).startsWith('insert into public.payments'))?.[1][6]).toBe('approved')
  })
  it('returns approved when the database guard permits the contract', async () => {
    database(protocol, 'approved')
    expect(await apply(checkout.id, raw, 'evt-1')).toEqual({ status: 'approved' })
  })
  it('locks the owning job before the checkout, consistently with contract writers', async () => {
    database(protocol)
    await apply(checkout.id, raw, 'evt-1')
    const queries = boundary.query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').toLowerCase())
    const jobLock = queries.findIndex(sql => sql.includes('from public.jobs') && sql.includes('for update'))
    const checkoutLock = queries.findIndex(sql => sql.includes('from public.marketplace_checkouts') && sql.includes('for update'))
    expect(jobLock).toBeGreaterThanOrEqual(0)
    expect(checkoutLock).toBeGreaterThan(jobLock)
  })
  it('pins financial FK parents before job/checkout/contract locks, not during a late projection insert', async () => {
    database(protocol)
    await apply(checkout.id, raw, 'evt-1')
    const queries = boundary.query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').toLowerCase())
    const customerLock = queries.findIndex(sql => sql.includes('from public.customer_profiles') && sql.includes('for key share'))
    const professionalLock = queries.findIndex(sql => sql.includes('from public.professional_profiles') && sql.includes('for key share'))
    const jobLock = queries.findIndex(sql => sql.includes('from public.jobs') && sql.includes('for update'))
    expect(customerLock).toBeGreaterThanOrEqual(0)
    expect(professionalLock).toBeGreaterThan(customerLock)
    expect(jobLock).toBeGreaterThan(professionalLock)
  })
  it('rejects an owner change while acquiring the locks before writing an observation', async () => {
    database(protocol, 'approved', { changedOwner: 'job_id' })
    await expect(apply(checkout.id, raw, 'evt-1')).rejects.toThrow('checkout_identity_changed')
    expect(boundary.query.mock.calls.some(([sql]) => String(sql).startsWith('insert into'))).toBe(false)
  })
  it.each(['customer_id', 'professional_id'] as const)('rejects changed %s after acquiring the financial parent locks', async changedOwner => {
    database(protocol, 'approved', { changedOwner })
    await expect(apply(checkout.id, raw, 'evt-1')).rejects.toThrow('checkout_identity_changed')
    expect(boundary.query.mock.calls.some(([sql]) => String(sql).startsWith('insert into'))).toBe(false)
  })
  it.each(['customer', 'professional'] as const)('fails closed for a missing financial %s parent', async missingParent => {
    database(protocol, 'approved', { missingParent })
    await expect(apply(checkout.id, raw, 'evt-1')).rejects.toThrow('checkout_identity_changed')
    expect(boundary.query.mock.calls.some(([sql]) => String(sql).startsWith('insert into'))).toBe(false)
  })
  it('fails instead of returning approval when the canonical checkout was not updated', async () => {
    database(protocol, null)
    await expect(apply(checkout.id, raw, 'evt-1')).rejects.toThrow('checkout_identity_changed')
  })
})
