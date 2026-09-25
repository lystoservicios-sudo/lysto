import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createProfessionalInvitation, resendProfessionalInvitation } from '@/lib/professional/onboarding-service'
import type { Session } from '@/lib/auth/session'

const dispatchProfessionalInvitation = vi.hoisted(() => vi.fn())
vi.mock('@/lib/notifications/server', () => ({ dispatchProfessionalInvitation }))
beforeEach(() => dispatchProfessionalInvitation.mockResolvedValue({ accepted: true, reason: null }))
afterEach(() => vi.unstubAllEnvs())

it('returns an invitation link once without exposing the token in the invitation summary', async () => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lystohogar.com')
  const token = 'a'.repeat(43)
  const rpc = vi.fn().mockResolvedValue({
    data: {
      id: '96000000-0000-4000-8000-000000000001',
      firstName: 'Ana', lastName: 'Pérez',
      email: 'tecnico@example.com',
      specialtySlug: 'aire_acondicionado',
      status: 'queued',
      expiresAt: '2026-10-06T12:00:00Z',
      createdAt: '2026-09-22T12:00:00Z',
      version: 1,
      token
    },
    error: null
  })
  const session = {
    role: 'admin', assuranceLevel: 'aal2', permissions: ['operations'], client: { rpc }
  } as unknown as Session

  const result = await createProfessionalInvitation(session, {
    firstName: 'Ana', lastName: 'Pérez',
    email: 'tecnico@example.com', specialtySlug: 'aire_acondicionado',
  })

  expect(result.link).toBe(`https://lystohogar.com/pro/onboarding/${token}`)
  expect(result.delivery).toEqual({ accepted: true, reason: null })
  expect(result.invitation.status).toBe('sent')
  expect(dispatchProfessionalInvitation).toHaveBeenCalledWith(result.invitation.id)
  expect(JSON.stringify(result.invitation)).not.toContain(token)
  expect(rpc).toHaveBeenCalledWith('create_professional_invitation_v2', {
    p_first_name: 'Ana', p_last_name: 'Pérez',
    p_email: 'tecnico@example.com',
    p_specialty_slug: 'aire_acondicionado'
  })
})

it('reports an unavailable email transport without claiming that the invitation was sent', async () => {
  dispatchProfessionalInvitation.mockResolvedValue({ accepted: false, reason: 'email_not_configured' })
  const invitation = {
    id: '96000000-0000-4000-8000-000000000001',
    firstName: 'Ana', lastName: 'Pérez',
    email: 'tecnico@example.com',
    specialtySlug: 'aire_acondicionado',
    status: 'queued',
    expiresAt: '2026-10-06T12:00:00Z',
    createdAt: '2026-09-22T12:00:00Z',
    version: 1
  }
  const rpc = vi.fn().mockResolvedValue({ data: invitation, error: null })
  const session = {
    role: 'admin', assuranceLevel: 'aal2', permissions: ['operations'], client: { rpc }
  } as unknown as Session

  await expect(createProfessionalInvitation(session, {
    firstName: 'Ana', lastName: 'Pérez',
    email: invitation.email,
    specialtySlug: invitation.specialtySlug
  })).resolves.toEqual({ invitation, link: null, delivery: { accepted: false, reason: 'email_not_configured' } })
})

it('renews the link for the same invitation before resending', async () => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lystohogar.com')
  const rpc = vi.fn().mockResolvedValue({ data: {
    id: '96000000-0000-4000-8000-000000000001', firstName: 'Ana', lastName: 'Pérez',
    email: 'tecnico@example.com', specialtySlug: 'aire_acondicionado', status: 'queued',
    expiresAt: '2099-10-06T12:00:00Z', createdAt: '2026-09-22T12:00:00Z', version: 2,
    token: 'b'.repeat(43)
  }, error: null })
  const session = {
    role: 'admin', assuranceLevel: 'aal2', permissions: ['owner'], client: { rpc }
  } as unknown as Session
  const invitationId = '96000000-0000-4000-8000-000000000001'
  await expect(resendProfessionalInvitation(session, { invitationId })).resolves.toEqual({
    delivery: { accepted: true, reason: null },
    link: `https://lystohogar.com/pro/onboarding/${'b'.repeat(43)}`
  })
  expect(dispatchProfessionalInvitation).toHaveBeenCalledWith(invitationId)
  expect(rpc).toHaveBeenCalledWith('renew_professional_invitation', { p_id: invitationId })
})
