// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ read: vi.fn(), query: vi.fn(), reconcile: vi.fn(), limit: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/payments/marketplace-config', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/payments/marketplace-config')>(),
  marketplaceConfig: () => ({ encryptionKey: Buffer.alloc(32, 42).toString('base64') })
}))
vi.mock('@/lib/payments/payment-return-receipt', () => ({ readPaymentReturnReceipt: mocks.read }))
vi.mock('@/lib/payments/marketplace-db', () => ({ paymentDatabase: () => ({ query: mocks.query }) }))
vi.mock('@/lib/payments/marketplace', () => ({ reconcileCheckout: mocks.reconcile }))
vi.mock('@/lib/security/rate-limit', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/security/rate-limit')>(), enforceRateLimit: mocks.limit
}))
import { GET, POST } from '@/app/api/payments/return/route'
import { issuePaymentReturnToken } from '@/lib/payments/payment-return-token'
const id = '92000000-0000-4000-8000-000000000001'
const key = Buffer.alloc(32, 42).toString('base64')
const paid = { id, amount: 100, status: 'approved', providerReferences: ['123'], lystoFee: 0 }
const request = (method = 'GET', token = issuePaymentReturnToken(id, key, new Date()), origin = 'https://lysto.test') =>
  new Request(`https://lysto.test/api/payments/return?checkoutId=${id}&status=approved`, {
    method, headers: { Authorization: `Bearer ${token}`, Origin: origin }
  })
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lysto.test')
  mocks.read.mockResolvedValue(paid)
})
it('returns the verified receipt without requiring any login cookie', async () => {
  const response = await GET(request())
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(paid)
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(mocks.reconcile).not.toHaveBeenCalled()
})
it('denies an unsigned or altered link before reading or reconciling', async () => {
  for (const token of ['', 'approved', issuePaymentReturnToken('92000000-0000-4000-8000-000000000002', key, new Date())]) {
    expect((await GET(request('GET', token))).status).toBe(403)
  }
  expect(mocks.read).not.toHaveBeenCalled()
  expect(mocks.query).not.toHaveBeenCalled()
})
it('reconciles only the signed checkout and rereads canonical state', async () => {
  mocks.read.mockResolvedValueOnce({ ...paid, status: 'pending', providerReferences: [] }).mockResolvedValueOnce(paid)
  mocks.query.mockResolvedValue({ rows: [{ id }] })
  const response = await POST(request('POST'))
  expect(response.status).toBe(200)
  expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('where id=$1::uuid'), [id])
  expect(mocks.reconcile).toHaveBeenCalledWith({ id })
  expect(await response.json()).toEqual(paid)
})
it('does not accept an unrelated site requesting a reconciliation', async () => {
  const response = await POST(request('POST', issuePaymentReturnToken(id, key, new Date()), 'https://unrelated.test'))
  expect(response.status).toBe(403)
  expect(mocks.read).not.toHaveBeenCalled()
})
it('does not turn an unverified URL status into approval', async () => {
  mocks.read.mockResolvedValue({ ...paid, status: 'pending', providerReferences: [] })
  const response = await GET(request())
  expect(await response.json()).toMatchObject({ status: 'pending', providerReferences: [] })
})
