import { afterEach, expect, it, vi } from 'vitest'
import { createProfessionalInvitation } from '@/lib/professional/onboarding-service'
import type { Session } from '@/lib/auth/session'

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
  expect(JSON.stringify(result.invitation)).not.toContain(token)
  expect(rpc).toHaveBeenCalledWith('create_professional_invitation', {
    p_email: 'tecnico@example.com',
    p_specialty_slug: 'aire_acondicionado',
    p_reason: 'Convocatoria para técnico de aire acondicionado'
  })
})
