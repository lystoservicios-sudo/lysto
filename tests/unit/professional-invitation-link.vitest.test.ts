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
    email: 'tecnico@example.com', specialtySlug: 'aire_acondicionado',
    reason: 'Convocatoria para técnico de aire acondicionado'
  })

  expect(result.link).toBe(`https://lystohogar.com/pro/onboarding/${token}`)
  expect(result.delivery).toEqual({ accepted: true, reason: null })
  expect(result.invitation.status).toBe('sent')
  expect(dispatchProfessionalInvitation).toHaveBeenCalledWith(result.invitation.id)
  expect(JSON.stringify(result.invitation)).not.toContain(token)
  expect(rpc).toHaveBeenCalledWith('create_professional_invitation', {
    p_email: 'tecnico@example.com',
    p_specialty_slug: 'aire_acondicionado',
    p_reason: 'Convocatoria para técnico de aire acondicionado'
  })
})

it('reports an unavailable email transport without claiming that the invitation was sent', async () => {
  dispatchProfessionalInvitation.mockResolvedValue({ accepted: false, reason: 'email_not_configured' })
  const invitation = {
    id: '96000000-0000-4000-8000-000000000001',
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
    email: invitation.email,
    specialtySlug: invitation.specialtySlug,
    reason: 'Convocatoria para técnico de aire acondicionado'
  })).resolves.toEqual({ invitation, link: null, delivery: { accepted: false, reason: 'email_not_configured' } })
})

it('retries the same invitation without creating a duplicate', async () => {
  const rpc = vi.fn()
  const session = {
    role: 'admin', assuranceLevel: 'aal2', permissions: ['owner'], client: { rpc }
  } as unknown as Session
  const invitationId = '96000000-0000-4000-8000-000000000001'
  await expect(resendProfessionalInvitation(session, { invitationId })).resolves.toEqual({
    delivery: { accepted: true, reason: null }
  })
  expect(dispatchProfessionalInvitation).toHaveBeenCalledWith(invitationId)
  expect(rpc).not.toHaveBeenCalled()
})
