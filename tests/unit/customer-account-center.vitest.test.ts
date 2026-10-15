import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
import { createClient } from '@supabase/supabase-js'
import type { Session } from '@/lib/auth/session'
import {
  readCustomerPreferences, updateCustomerPreferences, listCustomerAccountSessions,
  revokeCustomerAccountSessions, changeCustomerPassword, exportCustomerAccount,
  readCustomerPrivacy, requestCustomerAccountDeletion
} from '@/lib/customer-account/service'

const uid = '12000000-0000-4000-8000-000000000001'
const sid = '12000000-0000-4000-8000-000000000002'
const other = '12000000-0000-4000-8000-000000000003'
const prefs = { version: 0, emailMaintenance: true, emailSupportUpdates: true, marketingEmail: false, reduceMotion: false }
function fixture(data: unknown = { preferences: prefs, essentialEmail: true }) {
  const rpc = vi.fn().mockResolvedValue({ data, error: null })
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: uid, email: 'customer@lysto.test', app_metadata: { app_role: 'customer' } } }, error: null })
  const updateUser = vi.fn().mockResolvedValue({ data: {}, error: null })
  const session = { userId: uid, customerId: other, profileId: other, sessionId: sid, role: 'customer', client: { rpc, auth: { getUser, updateUser } } } as unknown as Session
  return { session, rpc, getUser, updateUser }
}
beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(createClient).mockReset()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://lysto-test.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-anon')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-only-secret')
})
function passwordProof(userId = uid, error: unknown = null) {
  const signInWithPassword = vi.fn().mockResolvedValue({ data: { user: error ? null : { id: userId, app_metadata: { app_role: 'customer' } }, session: error ? null : { access_token: 'transient' } }, error })
  const signOut = vi.fn().mockResolvedValue({ error: null })
  vi.mocked(createClient).mockReturnValueOnce({ auth: { signInWithPassword, signOut } } as never)
  return { signInWithPassword, signOut }
}
it('reads persisted preferences without client-supplied ownership', async () => {
  const f = fixture()
  expect(await readCustomerPreferences(f.session)).toEqual({ preferences: prefs, essentialEmail: true })
  expect(f.rpc).toHaveBeenCalledWith('read_customer_preferences', {})
})
it('writes preferences with an expected version, never essential notification switches', async () => {
  const f = fixture({ preferences: { ...prefs, version: 1 }, essentialEmail: true })
  await updateCustomerPreferences(f.session, prefs)
  expect(f.rpc).toHaveBeenCalledWith('write_customer_preferences', { p_expected_version: 0, p_email_maintenance: true, p_email_support_updates: true, p_marketing_email: false, p_reduce_motion: false })
  await expect(updateCustomerPreferences(f.session, { ...prefs, essentialEmail: false })).rejects.toThrow()
})
it('maps concurrent writes to a conflict instead of pretending to save', async () => {
  const f = fixture(); f.rpc.mockResolvedValue({ data: null, error: { code: 'PT409' } })
  await expect(updateCustomerPreferences(f.session, prefs)).rejects.toMatchObject({ code: 'conflict' })
})
it('rejects another application role before invoking a privileged account RPC', async () => {
  const f = fixture(); f.session.role = 'professional'
  await expect(readCustomerPreferences(f.session)).rejects.toMatchObject({ code: 'forbidden' })
  expect(f.rpc).not.toHaveBeenCalled()
})
it('returns sanitized session metadata only', async () => {
  const f = fixture([{ id: sid, current: true, createdAt: '2026-10-14T00:00:00Z', lastSeenAt: null, device: 'Chrome · Windows', refresh_token: 'never-return' }])
  expect(await listCustomerAccountSessions(f.session)).toEqual({ sessions: [{ id: sid, current: true, createdAt: '2026-10-14T00:00:00Z', lastSeenAt: null, device: 'Chrome · Windows' }] })
})
it('cannot revoke the current session through the other-devices control', async () => {
  const f = fixture({ revoked: 1 })
  await expect(revokeCustomerAccountSessions(f.session, { action: 'revoke', sessionId: sid })).rejects.toMatchObject({ code: 'invalid_input' })
  expect(f.rpc).not.toHaveBeenCalled()
  expect(await revokeCustomerAccountSessions(f.session, { action: 'revoke', sessionId: other })).toEqual({ revoked: 1 })
  expect(f.rpc).toHaveBeenCalledWith('revoke_customer_account_sessions', { p_session_id: other, p_all_others: false })
})
it('revokes other own sessions without accepting a user id', async () => {
  const f = fixture({ revoked: 2 })
  expect(await revokeCustomerAccountSessions(f.session, { action: 'revokeOthers' })).toEqual({ revoked: 2 })
  expect(f.rpc).toHaveBeenCalledWith('revoke_customer_account_sessions', { p_session_id: null, p_all_others: true })
})
it('changes passwords through Auth current-password verification and the existing password policy', async () => {
  const f = fixture()
  const proof = passwordProof()
  expect(await changeCustomerPassword(f.session, { currentPassword: 'old123', newPassword: 'Nueva123', confirmPassword: 'Nueva123' })).toEqual({ changed: true })
  expect(f.updateUser).toHaveBeenCalledWith({ password: 'Nueva123', current_password: 'old123' })
  expect(proof.signInWithPassword).toHaveBeenCalledWith({ email: 'customer@lysto.test', password: 'old123' })
  expect(proof.signOut).toHaveBeenCalledWith({ scope: 'local' })
})
it('rejects a wrong current password even if Auth updateUser would ignore current_password', async () => {
  const f = fixture()
  const proof = passwordProof(uid, { code: 'invalid_credentials' })
  await expect(changeCustomerPassword(f.session, { currentPassword: 'wrong123', newPassword: 'Nueva123', confirmPassword: 'Nueva123' })).rejects.toMatchObject({ code: 'unauthorized' })
  expect(f.updateUser).not.toHaveBeenCalled(); expect(proof.signOut).not.toHaveBeenCalled()
})
it('rejects a foreign password-proof identity without changing the current account', async () => {
  const f = fixture(); const proof = passwordProof(other)
  await expect(changeCustomerPassword(f.session, { currentPassword: 'old123', newPassword: 'Nueva123', confirmPassword: 'Nueva123' })).rejects.toMatchObject({ code: 'unauthorized' })
  expect(f.updateUser).not.toHaveBeenCalled(); expect(proof.signOut).toHaveBeenCalledWith({ scope: 'local' })
})
it('requires fresh trusted customer app metadata before password proof', async () => {
  const f = fixture(); f.getUser.mockResolvedValue({ data: { user: { id: uid, email: 'customer@lysto.test', app_metadata: { app_role: 'professional' } } }, error: null })
  await expect(changeCustomerPassword(f.session, { currentPassword: 'old123', newPassword: 'Nueva123', confirmPassword: 'Nueva123' })).rejects.toMatchObject({ code: 'unauthorized' })
  expect(f.updateUser).not.toHaveBeenCalled(); expect(createClient).not.toHaveBeenCalled()
})
it('always signs out the temporary proof session if updating the real password fails', async () => {
  const f = fixture(); const proof = passwordProof()
  f.updateUser.mockResolvedValue({ data: null, error: { code: 'weak_password' } })
  await expect(changeCustomerPassword(f.session, { currentPassword: 'old123', newPassword: 'Nueva123', confirmPassword: 'Nueva123' })).rejects.toMatchObject({ code: 'invalid_input' })
  expect(proof.signOut).toHaveBeenCalledWith({ scope: 'local' })
})
it('always signs out the temporary proof session if updating Auth throws', async () => {
  const f = fixture(); const proof = passwordProof()
  f.updateUser.mockRejectedValue(new Error('Auth unreachable'))
  await expect(changeCustomerPassword(f.session, { currentPassword: 'old123', newPassword: 'Nueva123', confirmPassword: 'Nueva123' })).rejects.toThrow('Auth unreachable')
  expect(proof.signOut).toHaveBeenCalledWith({ scope: 'local' })
})
it('does not call Auth for mismatched or unsupported passwords', async () => {
  const f = fixture()
  await expect(changeCustomerPassword(f.session, { currentPassword: 'old123', newPassword: 'short', confirmPassword: 'different' })).rejects.toThrow()
  expect(f.updateUser).not.toHaveBeenCalled()
})
it('requires the same authenticated user for password changes', async () => {
  const f = fixture(); f.getUser.mockResolvedValue({ data: { user: { id: other } }, error: null })
  await expect(changeCustomerPassword(f.session, { currentPassword: 'old123', newPassword: 'Nueva123', confirmPassword: 'Nueva123' })).rejects.toMatchObject({ code: 'unauthorized' })
  expect(f.updateUser).not.toHaveBeenCalled()
})
it('exports only the explicit account export contract', async () => {
  const f = fixture({ schemaVersion: 1, exportedAt: '2026-10-14T00:00:00Z', profile: { id: other, firstName: 'Cliente' }, addresses: [], homes: [], equipment: [], serviceRequests: [], requestAnswers: [], jobs: [], payments: [], serviceReports: [], warrantyClaims: [], maintenancePlans: [], supportCases: [], reviews: [], preferences: prefs, privacyRequests: [], providerSecret: 'never-return' })
  const result = await exportCustomerAccount(f.session)
  expect(result).not.toHaveProperty('providerSecret')
  expect(result.schemaVersion).toBe(1)
})
it('reads persisted deletion status and pending operations', async () => {
  const value = { request: null, pending: { jobs: 2, payments: 1 } }
  expect(await readCustomerPrivacy(fixture(value).session)).toEqual(value)
})
it('requires explicit confirmation before verifying the password or creating a deletion request', async () => {
  const f = fixture()
  await expect(requestCustomerAccountDeletion(f.session, { action: 'requestDeletion', confirmation: 'NO', idempotencyKey: other, currentPassword: 'old123' })).rejects.toThrow()
  expect(createClient).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled()
})
it('verifies the current password with an ephemeral Auth session, then consumes a bound receipt', async () => {
  const value = { request: { id: other, status: 'requested', createdAt: '2026-10-14T00:00:00Z', supportCaseId: other }, pending: { jobs: 1, payments: 0 } }
  const f = fixture(value)
  const signInWithPassword = vi.fn().mockResolvedValue({ data: { user: { id: uid, app_metadata: { app_role: 'customer' } }, session: { access_token: 'transient' } }, error: null })
  const signOut = vi.fn().mockResolvedValue({ error: null })
  const writerRpc = vi.fn().mockResolvedValue({ data: { receiptId: sid }, error: null })
  vi.mocked(createClient).mockReturnValueOnce({ auth: { signInWithPassword, signOut } } as never).mockReturnValueOnce({ rpc: writerRpc } as never)
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://lysto-test.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-anon')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-only-secret')
  expect(await requestCustomerAccountDeletion(f.session, { action: 'requestDeletion', confirmation: 'ELIMINAR', idempotencyKey: other, currentPassword: 'old123' })).toEqual(value)
  expect(signInWithPassword).toHaveBeenCalledWith({ email: 'customer@lysto.test', password: 'old123' })
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  expect(writerRpc).toHaveBeenCalledWith('issue_customer_account_reauth', { p_auth_user_id: uid, p_session_id: sid })
  expect(f.rpc).toHaveBeenCalledWith('request_customer_account_deletion', { p_idempotency_key: other, p_receipt_id: sid })
})
it('never issues an attestation or request when Auth rejects the current password', async () => {
  const f = fixture()
  const signOut = vi.fn()
  vi.mocked(createClient).mockReturnValueOnce({ auth: {
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: { code: 'invalid_credentials' } }), signOut
  } } as never)
  await expect(requestCustomerAccountDeletion(f.session, { action: 'requestDeletion', confirmation: 'ELIMINAR', idempotencyKey: other, currentPassword: 'incorrect' })).rejects.toMatchObject({ code: 'unauthorized' })
  expect(f.rpc).not.toHaveBeenCalled(); expect(signOut).not.toHaveBeenCalled()
})
it('rejects mismatched Auth proof and signs out only that temporary session', async () => {
  const f = fixture()
  const signOut = vi.fn().mockResolvedValue({ error: null })
  vi.mocked(createClient).mockReturnValueOnce({ auth: {
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: other }, session: { access_token: 'transient' } }, error: null }), signOut
  } } as never)
  await expect(requestCustomerAccountDeletion(f.session, { action: 'requestDeletion', confirmation: 'ELIMINAR', idempotencyKey: other, currentPassword: 'old123' })).rejects.toMatchObject({ code: 'unauthorized' })
  expect(f.rpc).not.toHaveBeenCalled(); expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
})
it('reports temporary session cleanup failure without losing a persisted privacy request', async () => {
  const value = { request: { id: other, status: 'requested', createdAt: '2026-10-14T00:00:00Z', supportCaseId: other }, pending: { jobs: 0, payments: 0 } }
  const f = fixture(value)
  const signOut = vi.fn().mockResolvedValue({ error: { code: 'auth_unavailable' } })
  vi.mocked(createClient).mockReturnValueOnce({ auth: {
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: uid, app_metadata: { app_role: 'customer' } }, session: { access_token: 'transient' } }, error: null }), signOut
  } } as never).mockReturnValueOnce({ rpc: vi.fn().mockResolvedValue({ data: { receiptId: sid }, error: null }) } as never)
  await expect(requestCustomerAccountDeletion(f.session, { action: 'requestDeletion', confirmation: 'ELIMINAR', idempotencyKey: other, currentPassword: 'old123' })).rejects.toMatchObject({ code: 'service_unavailable' })
  expect(f.rpc).toHaveBeenCalledWith('request_customer_account_deletion', { p_idempotency_key: other, p_receipt_id: sid })
  expect(await readCustomerPrivacy(f.session)).toEqual(value)
})
