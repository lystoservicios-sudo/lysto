// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import type { Session } from '@/lib/auth/session'
const boundary = vi.hoisted(() => ({ permission: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ requireAdminPermission: boundary.permission }))
import { adminChargeSchema, createAdminCharge, listAdminPaymentContext } from '@/lib/payments/admin-charges'

const session = { role: 'admin', permissions: ['finance'], client: { rpc: boundary.rpc } } as unknown as Session
const input = {
  jobId: '92000000-0000-4000-8000-000000000001', concept: 'Visita adicional',
  description: 'Trabajo adicional solicitado por el cliente.', amount: 100,
  commissionMode: 'standard', expectedCommissionRate: 0.18, reason: 'Autorizado por el responsable de operaciones.',
  idempotencyKey: '92000000-0000-4000-8000-000000000002'
}
beforeEach(() => {
  vi.clearAllMocks()
  boundary.permission.mockResolvedValue(session)
  boundary.rpc.mockResolvedValue({ data: { id: 'extra-1', status: 'proposed' }, error: null })
})
it.each(['standard', 'none'])('creates a %s proposal using server-derived owner and commission', async commissionMode => {
  const expectedCommissionRate = commissionMode === 'none' ? 0 : 0.18
  await expect(createAdminCharge(session, { ...input, commissionMode, expectedCommissionRate })).resolves.toMatchObject({ status: 'proposed' })
  expect(boundary.permission).toHaveBeenCalledWith('finance', session)
  expect(boundary.rpc).toHaveBeenCalledWith('create_admin_charge', {
    p_job_id: input.jobId, p_concept: input.concept, p_description: input.description,
    p_amount: 100, p_commission_mode: commissionMode, p_expected_commission_rate: expectedCommissionRate, p_reason: input.reason,
    p_idempotency_key: input.idempotencyKey
  })
})
it('rejects caller-supplied customer, seller and fee overrides', () => {
  for (const field of ['customerId', 'professionalId', 'marketplaceFee'])
    expect(adminChargeSchema.safeParse({ ...input, [field]: 0 }).success).toBe(false)
})
it.each([0, -1, 1.001, NaN, Infinity, 100000001])('rejects invalid amount %s', amount => {
  expect(adminChargeSchema.safeParse({ ...input, amount }).success).toBe(false)
})
it('does not touch the database when finance permission is denied', async () => {
  boundary.permission.mockRejectedValueOnce(new Error('forbidden'))
  await expect(createAdminCharge(session, input)).rejects.toThrow('forbidden')
  expect(boundary.rpc).not.toHaveBeenCalled()
})
it('preserves the caller command key for an uncertain retry', async () => {
  await createAdminCharge(session, input)
  await createAdminCharge(session, input)
  expect(boundary.rpc.mock.calls[0]).toEqual(boundary.rpc.mock.calls[1])
})
it('reports concurrent or stale changes as conflict', async () => {
  boundary.rpc.mockResolvedValue({ data: null, error: { code: '40001' } })
  await expect(createAdminCharge(session, input)).rejects.toMatchObject({ code: 'conflict' })
})
it('checks admin permissions before listing payment context', async () => {
  await expect(listAdminPaymentContext({ ...session, role: 'customer', permissions: [] } as unknown as Session)).rejects.toMatchObject({ code: 'forbidden' })
  expect(boundary.rpc).not.toHaveBeenCalled()
})
it('searches old services and resolves exact payment recipients outside the recent window', async () => {
  boundary.rpc.mockResolvedValue({ data: { commissionRate: 0.18, jobs: [] }, error: null })
  await listAdminPaymentContext(session, { search: '92000000', jobIds: [input.jobId] })
  expect(boundary.rpc).toHaveBeenCalledWith('get_admin_payment_context', {
    p_search: '92000000', p_job_ids: [input.jobId]
  })
})
