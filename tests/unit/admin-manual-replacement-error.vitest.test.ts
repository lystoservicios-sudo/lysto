// @vitest-environment node
import { expect, it, vi } from 'vitest'
import type { Session } from '@/lib/auth/session'
vi.mock('@/lib/payments/marketplace', () => ({ closeCheckoutAtProvider: vi.fn() }))
import { mutateJobException } from '@/lib/payments/financial-operations'
it('explains the administrative replacement path through the actual financial action service', async () => {
  const actor = { role: 'admin', permissions: ['owner'], assuranceLevel: 'aal2', client: {
    rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '22023', message: 'administrative_replacement_requires_new_request' } })
  } } as unknown as Session
  await expect(mutateJobException(actor, { action: 'resolveCase', caseId: '00000000-0000-4000-8000-000000000001',
    expectedVersion: 1, reason: 'Reemplazo de técnico para este servicio personalizado' }))
    .rejects.toMatchObject({ code: 'administrative_replacement_required' })
})
