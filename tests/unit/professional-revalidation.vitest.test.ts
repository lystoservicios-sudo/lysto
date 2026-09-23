// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { requestProfessionalRevalidation } from '@/lib/professional/onboarding-service'

const professionalId = '10000000-0000-0000-0000-000000000001'
const input = { professionalId, expectedVersion: 3, reason: 'La política documental actual requiere una nueva presentación' }

it('forbids a non-operations actor before reopening a dossier', async () => {
  const rpc = vi.fn()
  await expect(requestProfessionalRevalidation({ role: 'professional', assuranceLevel: 'aal1',
    permissions: [], client: { rpc } } as never, input)).rejects.toMatchObject({ code: 'forbidden' })
  expect(rpc).not.toHaveBeenCalled()
})

it('rejects an unexplained reopening before calling the database', async () => {
  const rpc = vi.fn()
  await expect(requestProfessionalRevalidation({ role: 'admin', assuranceLevel: 'aal2',
    permissions: ['operations'], client: { rpc } } as never,
  { ...input, reason: 'no' })).rejects.toThrow()
  expect(rpc).not.toHaveBeenCalled()
})
