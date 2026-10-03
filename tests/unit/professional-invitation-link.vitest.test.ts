import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createProfessionalInvitation, resendProfessionalInvitation } from '@/lib/professional/onboarding-service'
import type { Session } from '@/lib/auth/session'

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  password: vi.fn(),
  createUser: vi.fn(),
  updateUserById: vi.fn(),
  deleteUser: vi.fn()
}))
vi.mock('@/lib/notifications/server', () => ({ sendProfessionalTemporaryInvitation: mocks.send }))
vi.mock('@/lib/professional/temporary-password', () => ({ generateTemporaryProfessionalPassword: mocks.password }))
vi.mock('@/lib/supabase/env', () => ({ assertPublicSupabaseEnv: () => ({ url: 'https://example.supabase.co' }) }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { admin: {
    createUser: mocks.createUser,
    updateUserById: mocks.updateUserById,
    deleteUser: mocks.deleteUser
  } } })
}))

const invitationId = '96000000-0000-4000-8000-000000000001'
const authUserId = '96000000-0000-4000-8000-000000000002'
const token = 'a'.repeat(43)
const baseInvitation = {
  id: invitationId,
  firstName: 'Ana', lastName: 'Pérez',
  email: 'tecnico@example.com',
  specialtySlug: 'aire_acondicionado',
  status: 'queued',
  expiresAt: '2099-10-06T12:00:00Z',
  createdAt: '2026-09-22T12:00:00Z',
  version: 1
}

function session(rpc: ReturnType<typeof vi.fn>) {
  return { role: 'admin', assuranceLevel: 'aal2', permissions: ['operations'], client: { rpc } } as unknown as Session
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.password.mockReturnValue('4827163')
  mocks.send.mockResolvedValue({ accepted: true, reason: null })
  mocks.createUser.mockResolvedValue({ data: { user: { id: authUserId } }, error: null })
  mocks.updateUserById.mockResolvedValue({ data: { user: { id: authUserId } }, error: null })
  mocks.deleteUser.mockResolvedValue({ error: null })
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-only-test-key')
})
afterEach(() => vi.unstubAllEnvs())

it('provisions a professional identity and sends a temporary password without returning it to admin UI', async () => {
  const rpc = vi.fn(async (name: string) => name === 'create_professional_invitation_v2'
    ? { data: { ...baseInvitation, token }, error: null }
    : { data: null, error: null })
  const result = await createProfessionalInvitation(session(rpc), {
    firstName: 'Ana', lastName: 'Pérez', email: baseInvitation.email,
    specialtySlug: baseInvitation.specialtySlug
  })

  expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({
    email: baseInvitation.email,
    password: '4827163',
    email_confirm: true,
    app_metadata: { app_role: 'professional', signup_source: 'professional_invitation' }
  }))
  expect(rpc).toHaveBeenCalledWith('bind_professional_invitation_auth_user', {
    p_invitation_id: invitationId, p_auth_user_id: authUserId
  })
  expect(mocks.send).toHaveBeenCalledWith({
    email: baseInvitation.email, invitationToken: token, temporaryPassword: '4827163'
  })
  expect(result).toEqual({ invitation: { ...baseInvitation, status: 'sent' }, delivery: { accepted: true, reason: null } })
  expect(JSON.stringify(result)).not.toContain(token)
  expect(JSON.stringify(result)).not.toContain('4827163')
  expect(rpc).toHaveBeenCalledWith('mark_professional_invitation_sent', { p_invitation_id: invitationId })
})

it('does not claim a failed delivery was sent and keeps the invite recoverable', async () => {
  mocks.send.mockResolvedValue({ accepted: false, reason: 'email_not_configured' })
  const rpc = vi.fn(async (name: string) => name === 'create_professional_invitation_v2'
    ? { data: { ...baseInvitation, token }, error: null }
    : { data: null, error: null })
  const result = await createProfessionalInvitation(session(rpc), {
    firstName: 'Ana', lastName: 'Pérez', email: baseInvitation.email,
    specialtySlug: baseInvitation.specialtySlug
  })
  expect(result.invitation.status).toBe('queued')
  expect(result.delivery.accepted).toBe(false)
  expect(rpc).not.toHaveBeenCalledWith('mark_professional_invitation_sent', expect.anything())
})

it('rotates both the temporary password and invite token on resend without exposing either', async () => {
  const rotated = 'b'.repeat(43)
  const rpc = vi.fn(async (name: string) => name === 'renew_professional_invitation'
    ? { data: { ...baseInvitation, version: 2, token: rotated, provisionedAuthUserId: authUserId }, error: null }
    : { data: null, error: null })
  const result = await resendProfessionalInvitation(session(rpc), { invitationId })
  expect(mocks.updateUserById).toHaveBeenCalledWith(authUserId, { password: '4827163' })
  expect(mocks.send).toHaveBeenCalledWith({
    email: baseInvitation.email, invitationToken: rotated, temporaryPassword: '4827163'
  })
  expect(result).toEqual({ delivery: { accepted: true, reason: null } })
  expect(JSON.stringify(result)).not.toContain('4827163')
  expect(JSON.stringify(result)).not.toContain(rotated)
})
