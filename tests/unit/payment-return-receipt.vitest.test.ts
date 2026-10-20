// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/payments/marketplace-db', () => ({ paymentDatabase: () => ({ query: mocks.query }) }))
import { readPaymentReturnReceipt } from '@/lib/payments/payment-return-receipt'
import { issuePaymentReturnToken } from '@/lib/payments/payment-return-token'
const id = '92000000-0000-4000-8000-000000000001'
const key = Buffer.alloc(32, 42).toString('base64')
beforeEach(() => vi.resetAllMocks())

it('rejects a bare checkout ID or forged approval before querying any financial details', async () => {
  await expect(readPaymentReturnReceipt(id, 'approved', key)).rejects.toMatchObject({ code: 'forbidden' })
  expect(mocks.query).not.toHaveBeenCalled()
})
it('reads a narrow payment receipt with a valid return link without requiring an account role', async () => {
  const result = {
    id, jobId: '92000000-0000-4000-8000-000000000002', status: 'approved', amount: 100,
    lystoFee: 0, liveMode: true, extraId: null, extraLabel: null, service: 'Mantenimiento',
    professional: 'Quimey G', scheduledDate: null, timeWindow: null, providerReferences: ['123'],
    expiresAt: '2026-10-20T18:00:00Z'
  }
  mocks.query.mockResolvedValue({ rows: [{ data: result }] })
  const token = issuePaymentReturnToken(id, key, new Date())
  expect(await readPaymentReturnReceipt(id, token, key)).toEqual(result)
  expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('c.id=$1::uuid'), [id])
  const sql = mocks.query.mock.calls[0][0]
  expect(sql).toContain('j.customer_id=c.customer_id')
  expect(sql).not.toContain('email')
  expect(sql).not.toContain('address')
  expect(sql).not.toContain('serviceReceipt')
})
