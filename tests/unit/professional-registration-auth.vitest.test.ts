import { afterEach, expect, it, vi } from 'vitest'
import { invitationAuthentication } from '@/lib/professional/invitation-auth'

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(), createUser: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(), rpc: vi.fn(), refreshSession: vi.fn()
}))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({ auth: {
  signInWithPassword: mocks.signInWithPassword, signOut: mocks.signOut, refreshSession: mocks.refreshSession
}, rpc: mocks.rpc }) }))
vi.mock('@/lib/supabase/env', () => ({ assertPublicSupabaseEnv: () => ({ url: 'https://example.supabase.co' }) }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
  auth: { admin: { createUser: mocks.createUser } }
}) }))
afterEach(() => { vi.unstubAllEnvs(); Object.values(mocks).forEach((mock) => mock.mockReset()) })

it('creates a confirmed professional and consumes the invitation during password setup', async () => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-only-test-key')
  mocks.maybeSingle.mockResolvedValue({ data: {
    id: '96000000-0000-4000-8000-000000000001', email: 'ana@example.com', status: 'sent',
    expires_at: '2099-01-01T00:00:00Z', consumed_at: null, bound_auth_user_id: null, flow_version: 2
  }, error: null })
  mocks.createUser.mockResolvedValue({ data: { user: { id: '96000000-0000-4000-8000-000000000002' } }, error: null })
  mocks.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null })
  mocks.rpc.mockResolvedValue({ data: { professionalId: '96000000-0000-4000-8000-000000000003', status: 'form_started' }, error: null })
  mocks.refreshSession.mockResolvedValue({ data: { session: {} }, error: null })
  await expect(invitationAuthentication({ token: 'a'.repeat(43), password: 'Clav3Seg!' }, true))
    .resolves.toEqual({ professionalId: '96000000-0000-4000-8000-000000000003' })
  expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({
    email: 'ana@example.com', password: 'Clav3Seg!', email_confirm: true,
    app_metadata: { app_role: 'professional', signup_source: 'professional_invitation' }
  }))
  expect(mocks.rpc).toHaveBeenCalledWith('accept_professional_invitation', { p_token: 'a'.repeat(43) })
})

it.each(['short7!', 'this-password-is-too-long'])('rejects a password outside 8–12 characters', async (password) => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-only-test-key')
  await expect(invitationAuthentication({ token: 'a'.repeat(43), password }, true)).rejects.toThrow()
  expect(mocks.createUser).not.toHaveBeenCalled()
})

it('resumes acceptance if the first attempt created the identity but stopped before consuming the token', async () => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-only-test-key')
  mocks.maybeSingle.mockResolvedValue({ data: { id: '96000000-0000-4000-8000-000000000001',
    email: 'ana@example.com', status: 'sent', expires_at: '2099-01-01T00:00:00Z',
    consumed_at: null, bound_auth_user_id: null, flow_version: 2 }, error: null })
  mocks.createUser.mockResolvedValue({ data: { user: null }, error: { code: 'email_exists' } })
  mocks.signInWithPassword.mockResolvedValue({ data: { session: {}, user: {
    app_metadata: { app_role: 'professional', signup_source: 'professional_invitation' }
  } }, error: null })
  mocks.rpc.mockResolvedValue({ data: { professionalId: '96000000-0000-4000-8000-000000000003', status: 'form_started' }, error: null })
  mocks.refreshSession.mockResolvedValue({ data: { session: {} }, error: null })
  await expect(invitationAuthentication({ token: 'a'.repeat(43), password: 'Clav3Seg!' }, true))
    .resolves.toEqual({ professionalId: '96000000-0000-4000-8000-000000000003' })
})

it('clears a pre-existing customer session when an invitation cannot claim that identity', async () => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-only-test-key')
  mocks.maybeSingle.mockResolvedValue({ data: { id: '96000000-0000-4000-8000-000000000001',
    email: 'ana@example.com', status: 'sent', expires_at: '2099-01-01T00:00:00Z',
    consumed_at: null, bound_auth_user_id: null, flow_version: 2 }, error: null })
  mocks.createUser.mockResolvedValue({ data: { user: null }, error: { code: 'email_exists' } })
  mocks.signInWithPassword.mockResolvedValue({ data: { session: {}, user: {
    app_metadata: { app_role: 'customer' }
  } }, error: null })
  mocks.signOut.mockResolvedValue({ error: null })
  await expect(invitationAuthentication({ token: 'a'.repeat(43), password: 'Clav3Seg!' }, true))
    .rejects.toThrow()
  expect(mocks.signOut).toHaveBeenCalled()
  expect(mocks.rpc).not.toHaveBeenCalled()
})

it('accepts a confirmed legacy invitation with its previously created password', async () => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-only-test-key')
  mocks.maybeSingle.mockResolvedValue({ data: { id: '96000000-0000-4000-8000-000000000001',
    email: 'ana@example.com', status: 'sent', expires_at: '2099-01-01T00:00:00Z',
    consumed_at: null, bound_auth_user_id: null, flow_version: 1 }, error: null })
  mocks.signInWithPassword.mockResolvedValue({ data: { session: {}, user: {
    app_metadata: { app_role: 'customer' }, user_metadata: { professional_onboarding: true }
  } }, error: null })
  mocks.rpc.mockResolvedValue({ data: { professionalId: '96000000-0000-4000-8000-000000000003',
    status: 'form_started' }, error: null })
  mocks.refreshSession.mockResolvedValue({ data: { session: {} }, error: null })
  await expect(invitationAuthentication({ token: 'a'.repeat(43),
    password: 'old-password-long', existingPassword: true }, true)).resolves.toEqual({
    professionalId: '96000000-0000-4000-8000-000000000003'
  })
  expect(mocks.createUser).not.toHaveBeenCalled()
  expect(mocks.rpc).toHaveBeenCalledWith('accept_professional_invitation', { p_token: 'a'.repeat(43) })
})
