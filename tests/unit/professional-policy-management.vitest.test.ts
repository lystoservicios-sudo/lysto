// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { saveProfessionalPolicyDraft, activateProfessionalPolicy } from '@/lib/professional/professional-policies'

const categoryId = '10000000-0000-0000-0000-000000000001'
const policy = { version: '2026-01', requiredDocuments: ['identity_front', 'identity_back', 'license'],
  expiryDocuments: ['license'], requiredTools: [], minExperience: 0, requiresLicense: true }
function session(role = 'admin', aal = 'aal2') {
  return { role, assuranceLevel: aal, permissions: ['operations'],
    client: { rpc: vi.fn().mockResolvedValue({ data: { categoryId, version: '2026-01', state: 'draft' }, error: null }) } }
}

it('allows only operations with MFA to draft explicit requirements', async () => {
  const actor = session()
  await saveProfessionalPolicyDraft(actor as never, { categoryId, policy })
  expect(actor.client.rpc).toHaveBeenCalledWith('save_professional_policy_draft',
    { p_category_id: categoryId, p_policy: policy })
})

it.each([['customer', 'aal2'], ['admin', 'aal1']])('rejects %s at %s', async (role, aal) => {
  const actor = session(role, aal)
  await expect(saveProfessionalPolicyDraft(actor as never, { categoryId, policy })).rejects.toMatchObject({ code: 'forbidden' })
  expect(actor.client.rpc).not.toHaveBeenCalled()
})

it('rejects undocumented types before calling the database', async () => {
  const actor = session()
  await expect(saveProfessionalPolicyDraft(actor as never, { categoryId,
    policy: { ...policy, requiredDocuments: ['arbitrary'] } })).rejects.toThrow()
  expect(actor.client.rpc).not.toHaveBeenCalled()
})

it('requires a reason and an acknowledged impact to activate', async () => {
  const actor = session()
  await expect(activateProfessionalPolicy(actor as never, { categoryId, version: '2026-01',
    expectedImpact: 3, reason: 'Aprobado por operaciones' })).resolves.toMatchObject({ categoryId })
  expect(actor.client.rpc).toHaveBeenCalledWith('activate_professional_policy',
    { p_category_id: categoryId, p_version: '2026-01', p_expected_impact: 3,
      p_reason: 'Aprobado por operaciones' })
})
