// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const fixtures = vi.hoisted(() => ({
  verify: vi.fn(),
  signOut: vi.fn(),
  update: vi.fn(),
  getUser: vi.fn(),
  getClaims: vi.fn(),
  assurance: vi.fn(),
  factors: vi.fn(),
  challenge: vi.fn(),
  bootstrap: vi.fn(),
  rpc: vi.fn()
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    rpc: fixtures.rpc,
    auth: {
      verifyOtp: fixtures.verify,
      signOut: fixtures.signOut,
      updateUser: fixtures.update,
      getUser: fixtures.getUser,
      getClaims: fixtures.getClaims,
      mfa: { getAuthenticatorAssuranceLevel: fixtures.assurance, listFactors: fixtures.factors, challengeAndVerify: fixtures.challenge }
    }
  })
}))
vi.mock('@/lib/auth/account-server', () => ({ bootstrapVerifiedCustomer: fixtures.bootstrap }))
import { GET as confirmGet, POST as confirmPost } from '../../app/auth/confirm/route'
import { POST as logoutPost } from '../../app/auth/logout/route'
import { POST as resetPost } from '../../app/auth/reset-password/route'

const origin = 'http://127.0.0.1:3100'
const token = 'a'.repeat(64)
function post(path: string, values: Record<string, string>, requestOrigin: string | null = origin) {
  return new Request(origin + path, {
    method: 'POST',
    headers: requestOrigin ? { origin: requestOrigin } : {},
    body: new URLSearchParams(values)
  })
}

function postWithHeaders(path: string, values: Record<string, string>, headers: HeadersInit) {
  return new Request(origin + path, {
    method: 'POST',
    headers,
    body: new URLSearchParams(values)
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_APP_URL', origin)
  vi.stubEnv('RATE_LIMIT_HASH_KEY', 'disposable-recovery-signing-key-at-least-32-characters')
  fixtures.getClaims.mockResolvedValue({ data: { claims: { sub: 'user', session_id: 'session' } }, error: null })
  fixtures.assurance.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null })
  fixtures.factors.mockResolvedValue({ data: { totp: [{ id: 'factor', status: 'verified', friendly_name: 'Mi autenticador' }] }, error: null })
  fixtures.challenge.mockResolvedValue({ data: {}, error: null })
  fixtures.verify.mockResolvedValue({
    data: { user: { id: 'user', app_metadata: { app_role: 'customer' } } },
    error: null
  })
  fixtures.bootstrap.mockResolvedValue('ready')
  fixtures.signOut.mockResolvedValue({ error: null })
  fixtures.update.mockResolvedValue({ error: null })
  fixtures.getUser.mockResolvedValue({ data: { user: { id: 'user' } }, error: null })
  fixtures.rpc.mockResolvedValue({ data: true, error: null })
})
describe('account route boundaries', () => {
  const recoveryValues = { token_hash: token, password: 'Clave123', repeatPassword: 'Clave123' }
  function jsonReset(values: Record<string, string>) {
    return resetPost(postWithHeaders('/auth/reset-password', values, { origin, accept: 'application/json' }))
  }
  it('asks for MFA and retries an incorrect code without consuming the email link again', async () => {
    fixtures.assurance.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null })
    const pending = await jsonReset(recoveryValues)
    expect(pending.status).toBe(200)
    expect(fixtures.update).not.toHaveBeenCalled()
    expect(fixtures.signOut).not.toHaveBeenCalled()
    const challenge = await pending.json()
    expect(challenge.factors).toEqual([{ id: 'factor', name: 'Mi autenticador' }])
    expect(challenge.continuation).toEqual(expect.any(String))
    fixtures.challenge.mockResolvedValueOnce({ data: null, error: { code: 'mfa_verification_failed' } })
    const values = { continuation: challenge.continuation, password: 'Clave123', repeatPassword: 'Clave123', factorId: 'factor', code: '123456' }
    expect((await jsonReset(values)).status).toBe(400)
    expect(fixtures.update).not.toHaveBeenCalled()
    const success = await jsonReset(values)
    expect((await success.json()).redirectTo).toBe('/login?reset=success')
    expect(fixtures.verify).toHaveBeenCalledTimes(1)
    expect(fixtures.challenge).toHaveBeenCalledWith({ factorId: 'factor', code: '123456' })
    expect(fixtures.update).toHaveBeenCalledTimes(1)
  })
  it('binds MFA continuation to the verified recovery session', async () => {
    fixtures.assurance.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null })
    const pending = await (await jsonReset(recoveryValues)).json()
    fixtures.getClaims.mockResolvedValue({ data: { claims: { sub: 'user', session_id: 'another-session' } }, error: null })
    const response = await jsonReset({ ...recoveryValues, continuation: pending.continuation, factorId: 'factor', code: '123456' })
    expect(response.status).toBe(400)
    expect(fixtures.challenge).not.toHaveBeenCalled()
    expect(fixtures.update).not.toHaveBeenCalled()
  })
  it.each(['professional', 'admin'])('returns recovered %s accounts to the team login', async (role) => {
    fixtures.verify.mockResolvedValue({ data: { user: { id: 'user', app_metadata: { app_role: role } } }, error: null })
    const response = await resetPost(post('/auth/reset-password', recoveryValues))
    expect(response.headers.get('location')).toBe(origin + '/equipo/login?reset=success')
  })
  it('renders a safe native MFA retry form without reflecting the password', async () => {
    fixtures.assurance.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null })
    const response = await resetPost(post('/auth/reset-password', recoveryValues))
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('name="continuation"')
    expect(html).toContain('name="code"')
    expect(html).not.toContain(recoveryValues.password)
    expect(html).not.toContain(token)
    expect(fixtures.update).not.toHaveBeenCalled()
  })
  it('preserves the native MFA continuation after a password confirmation typo', async () => {
    fixtures.assurance.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null })
    const pending = await (await jsonReset(recoveryValues)).json()
    const response = await resetPost(post('/auth/reset-password', { continuation: pending.continuation, password: 'Clave123', repeatPassword: 'Otra1234' }))
    expect(response.status).toBe(400)
    const html = await response.text()
    expect(html).toContain(`name="continuation" value="${pending.continuation}"`)
    expect(html).toContain('name="code"')
    expect(html).not.toContain('Clave123')
    expect(fixtures.verify).toHaveBeenCalledTimes(1)
    expect(fixtures.challenge).not.toHaveBeenCalled()
    expect(fixtures.update).not.toHaveBeenCalled()
  })
  it.each(['same_password', 'weak_password'])('lets a recovered user retry a rejected password: %s', async (code) => {
    fixtures.update.mockResolvedValueOnce({ error: { code } })
    const failed = await jsonReset(recoveryValues)
    expect(failed.status).toBe(400)
    const retry = await failed.json()
    expect(retry.continuation).toEqual(expect.any(String))
    expect(fixtures.signOut).not.toHaveBeenCalled()
    const response = await jsonReset({ continuation: retry.continuation, password: 'Otra1234', repeatPassword: 'Otra1234' })
    expect((await response.json()).redirectTo).toBe('/login?reset=success')
    expect(fixtures.verify).toHaveBeenCalledTimes(1)
  })
  it('fails closed when MFA assurance cannot be read', async () => {
    fixtures.assurance.mockResolvedValue({ data: null, error: { code: 'unavailable' } })
    expect((await jsonReset(recoveryValues)).status).toBe(503)
    expect(fixtures.update).not.toHaveBeenCalled()
  })
  it('routes an invitation registration to bounded onboarding without bootstrapping a customer', async () => {
    fixtures.verify.mockResolvedValue({
      data: {
        user: {
          id: 'user',
          app_metadata: { app_role: 'customer' },
          user_metadata: { professional_onboarding: true }
        }
      },
      error: null
    })
    const response = await confirmPost(post('/auth/confirm', { token_hash: token }))
    expect(response.headers.get('location')).toBe(origin + '/pro/onboarding')
    expect(fixtures.bootstrap).not.toHaveBeenCalled()
  })
  it('GET previews never consume confirmation tokens or establish sessions', async () => {
    const response = await confirmGet(
      new Request(`${origin}/auth/confirm?token_hash=${token}&next=https://evil.test`)
    )
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('method="post"')
    expect(fixtures.verify).not.toHaveBeenCalled()
    expect(response.headers.get('referrer-policy')).toBe('same-origin')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
  it.each([null, 'https://evil.test'])(
    'rejects confirmation without same-origin POST: %s',
    async (source) => {
      expect((await confirmPost(post('/auth/confirm', { token_hash: token }, source))).status).toBe(
        403
      )
      expect(fixtures.verify).not.toHaveBeenCalled()
    }
  )
  it('accepts the confirmation nonce when the browser serializes Origin as null', async () => {
    const preview = await confirmGet(new Request(`${origin}/auth/confirm?token_hash=${token}`))
    const cookie = preview.headers.get('set-cookie')!
    const csrf = (await preview.text()).match(/name="csrf_token" value="([a-zA-Z0-9_-]+)"/)![1]
    const response = await confirmPost(
      postWithHeaders(
        '/auth/confirm',
        { token_hash: token, csrf_token: csrf },
        { origin: 'null', cookie: cookie.split(';', 1)[0] }
      )
    )
    expect(response.headers.get('location')).toBe(origin + '/app')
  })
  it('rejects a missing confirmation nonce when Origin is null', async () => {
    const response = await confirmPost(
      postWithHeaders('/auth/confirm', { token_hash: token }, { origin: 'null' })
    )
    expect(response.status).toBe(403)
    expect(fixtures.verify).not.toHaveBeenCalled()
  })
  it('verifies only an email token and ignores attacker-supplied type/redirect', async () => {
    const response = await confirmPost(
      post('/auth/confirm', { token_hash: token, type: 'recovery', next: 'https://evil.test' })
    )
    expect(fixtures.verify).toHaveBeenCalledWith({ token_hash: token, type: 'email' })
    expect(response.headers.get('location')).toBe(origin + '/app')
  })
  it('preserves verified Auth account when profile completion remains necessary', async () => {
    fixtures.bootstrap.mockResolvedValue('incomplete')
    expect(
      (await confirmPost(post('/auth/confirm', { token_hash: token }))).headers.get('location')
    ).toBe(origin + '/completar-cuenta')
    expect(fixtures.signOut).not.toHaveBeenCalled()
  })
  it('shows an actionable error for expired/reused token', async () => {
    fixtures.verify.mockResolvedValue({ data: { user: null }, error: { code: 'otp_expired' } })
    const response = await confirmPost(post('/auth/confirm', { token_hash: token }))
    expect(response.status).toBe(400)
    expect(await response.text()).toContain('venció o ya fue utilizado')
    expect(fixtures.bootstrap).not.toHaveBeenCalled()
  })
  it('rejects an invalid new password before consuming recovery token', async () => {
    expect(
      (
        await resetPost(
          post('/auth/reset-password', {
            token_hash: token,
            password: 'short',
            repeatPassword: 'short'
          })
        )
      ).status
    ).toBe(400)
    expect(fixtures.verify).not.toHaveBeenCalled()
  })
  it.each([null, 'null', 'https://evil.test'])(
    'rejects password recovery from an untrusted origin before consuming its token: %s',
    async (source) => {
      const response = await resetPost(post('/auth/reset-password', {
        token_hash: token, password: 'Clave123', repeatPassword: 'Clave123'
      }, source))
      expect(response.status).toBe(403)
      expect(fixtures.verify).not.toHaveBeenCalled()
      expect(fixtures.update).not.toHaveBeenCalled()
    }
  )
  it('requires a recovery token before changing password and closes sessions afterward', async () => {
    const password = 'Clave123'
    const response = await resetPost(
      post('/auth/reset-password', {
        token_hash: token,
        password,
        repeatPassword: password
      })
    )
    expect(fixtures.verify).toHaveBeenCalledWith({ token_hash: token, type: 'recovery' })
    expect(fixtures.update).toHaveBeenCalledWith({ password })
    expect(fixtures.signOut).toHaveBeenCalledWith({ scope: 'global' })
    expect(response.headers.get('location')).toBe(origin + '/login?reset=success')
  })
  it('does not change a password if the recovery token is invalid', async () => {
    fixtures.verify.mockResolvedValue({ data: { user: null }, error: { code: 'otp_expired' } })
    expect(
      (
        await resetPost(
          post('/auth/reset-password', {
            token_hash: token,
            password: 'Clave123',
            repeatPassword: 'Clave123'
          })
        )
      ).status
    ).toBe(400)
    expect(fixtures.update).not.toHaveBeenCalled()
  })
  it('rejects cross-origin logout without touching Auth', async () => {
    expect((await logoutPost(post('/auth/logout', {}, 'https://evil.test'))).status).toBe(403)
    expect(fixtures.getUser).not.toHaveBeenCalled()
  })
  it('logs out the verified current session and redirects to login', async () => {
    const response = await logoutPost(post('/auth/logout', {}))
    expect(fixtures.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(response.headers.get('location')).toBe(origin + '/login?logout=success')
  })
})
