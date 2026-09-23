// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const fixtures = vi.hoisted(() => ({
  verify: vi.fn(),
  signOut: vi.fn(),
  update: vi.fn(),
  getUser: vi.fn(),
  bootstrap: vi.fn()
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: {
      verifyOtp: fixtures.verify,
      signOut: fixtures.signOut,
      updateUser: fixtures.update,
      getUser: fixtures.getUser
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
  fixtures.verify.mockResolvedValue({
    data: { user: { id: 'user', app_metadata: { app_role: 'customer' } } },
    error: null
  })
  fixtures.bootstrap.mockResolvedValue('ready')
  fixtures.signOut.mockResolvedValue({ error: null })
  fixtures.update.mockResolvedValue({ error: null })
  fixtures.getUser.mockResolvedValue({ data: { user: { id: 'user' } }, error: null })
})
describe('account route boundaries', () => {
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
  it('requires a recovery token before changing password and closes sessions afterward', async () => {
    const response = await resetPost(
      post('/auth/reset-password', {
        token_hash: token,
        password: 'ClaveNuevaLarga123!',
        repeatPassword: 'ClaveNuevaLarga123!'
      })
    )
    expect(fixtures.verify).toHaveBeenCalledWith({ token_hash: token, type: 'recovery' })
    expect(fixtures.update).toHaveBeenCalledWith({ password: 'ClaveNuevaLarga123!' })
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
            password: 'ClaveNuevaLarga123!',
            repeatPassword: 'ClaveNuevaLarga123!'
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
