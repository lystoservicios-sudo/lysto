import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  quoteWriter: vi.fn(),
  rpc: vi.fn()
}))

vi.mock('@/lib/pricing/server', () => ({ quoteWriter: mocks.quoteWriter }))

import { createOwnerSplitTestJob } from '@/lib/payments/owner-split-test-job'

beforeEach(() => {
  mocks.rpc.mockReset().mockResolvedValue({ data: '8d48f672-dd86-46f0-926b-faa64a37a8d2', error: null })
  mocks.quoteWriter.mockReset().mockReturnValue({ rpc: mocks.rpc })
})

it('creates the fixed split-test job through the restricted owner-only database operation', async () => {
  const quote = { total: 1000, platformFee: 180, professionalAmount: 820 }
  const input = {
    actorUserId: 'e45a5ba3-548b-402b-b6cd-96e594ee5b27',
    actorSessionId: '9ee43737-dd66-413f-8198-d3748604e029',
    customerId: 'c06c507f-607c-42c1-b9b4-35ee6fe9d23d',
    professionalId: '42e7e079-b464-49c8-b117-2d0613675595',
    quote
  }

  await expect(createOwnerSplitTestJob(input)).resolves.toBe('8d48f672-dd86-46f0-926b-faa64a37a8d2')
  expect(mocks.rpc).toHaveBeenCalledWith('create_owner_marketplace_split_test_job', {
    p_actor_user_id: input.actorUserId,
    p_actor_session_id: input.actorSessionId,
    p_customer_id: input.customerId,
    p_professional_id: input.professionalId,
    p_quote: quote
  })
})

it('surfaces a scoped error when the database refuses the owner split-test operation', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'forbidden' } })

  await expect(createOwnerSplitTestJob({
    actorUserId: 'e45a5ba3-548b-402b-b6cd-96e594ee5b27',
    actorSessionId: '9ee43737-dd66-413f-8198-d3748604e029',
    customerId: 'c06c507f-607c-42c1-b9b4-35ee6fe9d23d',
    professionalId: '42e7e079-b464-49c8-b117-2d0613675595',
    quote: {}
  })).rejects.toThrow('owner_split_test_job:42501')
})
