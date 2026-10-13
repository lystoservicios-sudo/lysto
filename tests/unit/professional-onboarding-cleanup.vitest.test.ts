import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { clearOwnedProfessionalOnboardingOutbox } from '../integration/professional-onboarding-cleanup'

const invitation = '10000000-0000-4000-8000-000000000001'
const professional = '10000000-0000-4000-8000-000000000002'
const recipient = '10000000-0000-4000-8000-000000000003'

describe('owned professional onboarding outbox cleanup', () => {
  it('includes professional lifecycle aggregates and recipients, not only invitations', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 3 })
    await clearOwnedProfessionalOnboardingOutbox({ query }, {
      invitationIds: [invitation], professionalIds: [professional], recipientProfileIds: [recipient]
    })
    expect(query).toHaveBeenCalledOnce()
    expect(query).toHaveBeenCalledWith(
      'delete from private.outbox_events where recipient_profile_id=any($1::uuid[]) or aggregate_id=any($2::uuid[])',
      [[recipient], [invitation, professional]]
    )
  })

  it('retains a bounded recipient-only cleanup when no invitation aggregate remains', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 })
    await clearOwnedProfessionalOnboardingOutbox({ query }, {
      invitationIds: [], professionalIds: [], recipientProfileIds: [recipient]
    })
    expect(query).toHaveBeenCalledWith(
      'delete from private.outbox_events where recipient_profile_id=any($1::uuid[]) or aggregate_id=any($2::uuid[])',
      [[recipient], []]
    )
  })

  it('deduplicates registered IDs without widening the deletion scope', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 })
    await clearOwnedProfessionalOnboardingOutbox({ query }, {
      invitationIds: [invitation, invitation],
      professionalIds: [professional, professional],
      recipientProfileIds: [recipient, recipient]
    })
    expect(query).toHaveBeenCalledWith(expect.any(String), [[recipient], [invitation, professional]])
  })

  it('does not issue a deletion for an empty recorded scope', async () => {
    const query = vi.fn()
    await clearOwnedProfessionalOnboardingOutbox({ query }, {
      invitationIds: [], professionalIds: [], recipientProfileIds: []
    })
    expect(query).not.toHaveBeenCalled()
  })

  it('fails closed on a malformed ID before touching the database', async () => {
    const query = vi.fn()
    await expect(clearOwnedProfessionalOnboardingOutbox({ query }, {
      invitationIds: ['*'], professionalIds: [professional], recipientProfileIds: []
    })).rejects.toThrow('Invalid registered cleanup ID')
    expect(query).not.toHaveBeenCalled()
  })

  it('clears the scoped outbox before the integration harness deletes synthetic Auth', async () => {
    const source = await readFile(
      resolve(process.cwd(), 'tests/integration/professional-onboarding.test.ts'), 'utf8'
    )
    const cleanup = source.indexOf('await clearOwnedProfessionalOnboardingOutbox(')
    const authDeletion = source.indexOf('storageAdmin.auth.admin.deleteUser(row.id)')
    expect(cleanup >= 0 && authDeletion > cleanup).toBe(true)
  })
})
