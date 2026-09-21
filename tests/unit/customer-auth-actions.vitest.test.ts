import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ signUp: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(), read: vi.fn(), resetPasswordForEmail: vi.fn(), signInWithOAuth: vi.fn(), origin: vi.fn(), bootstrap: vi.fn(), rpc: vi.fn(), policy: vi.fn(), limit: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({ auth: mocks, rpc: mocks.rpc }) }))
vi.mock('@/lib/auth/customer-session', () => ({ resolvedCustomerDestination: mocks.read }))
vi.mock('@/lib/auth/account-server', () => ({ assertAccountMutationOrigin: mocks.origin, bootstrapVerifiedCustomer: mocks.bootstrap, accountFormText: (form: FormData, key: string) => String(form.get(key) ?? '') }))
vi.mock('@/lib/auth/account-policy', () => ({ getRegistrationPolicy: mocks.policy }))
vi.mock('@/lib/security/rate-limit', () => ({ enforceRateLimit: mocks.limit, serverActionSubject: async (email: string) => email }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
import { loginAction } from '../../app/(auth)/login/actions'
import { loginAction as staffLogin } from '../../app/(auth)/equipo/login/actions'
import { registerAction, recoverPasswordAction, googleAuthAction } from '../../app/(auth)/actions'
const initial = { status: 'idle' as const, email: '', message: '' }
function form(values: Record<string, string>) { const data = new FormData(); Object.entries(values).forEach(([k,v]) => data.set(k,v)); return data }
const signup = { email: 'ANA@example.com', password: 'a-password-123', confirmPassword: 'a-password-123', firstName: 'Ana', lastName: 'Pérez', phone: '+541112345678', accepted: 'on', termsVersion: 't1', privacyVersion: 'p1' }
beforeEach(() => {
  vi.resetAllMocks(); process.env.NEXT_PUBLIC_APP_URL = 'https://lysto.test'
  mocks.policy.mockResolvedValue({ termsVersion: 't1', privacyVersion: 'p1' })
  mocks.bootstrap.mockResolvedValue('ready')
  mocks.rpc.mockResolvedValue({ data: { role: 'customer', professional_status: null, professional_eligible: false, aal: 'aal1' }, error: null })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('customer authentication server actions', () => {
  it('rejects missing legal acceptance without calling Auth', async () => {
    expect((await registerAction(initial, form({ ...signup, accepted: '' }))).status).toBe('error')
    expect(mocks.signUp).not.toHaveBeenCalled()
  })
  it('records versioned consent and personal fields without user-chosen authority', async () => {
    mocks.signUp.mockResolvedValue({ error: null })
    expect((await registerAction(initial, form(signup))).status).toBe('success')
    expect(mocks.signUp.mock.calls[0][0]).toMatchObject({ email: 'ana@example.com', options: { data: { first_name: 'Ana', phone: signup.phone, accepted: true, terms_version: 't1', privacy_version: 'p1' } } })
    expect(mocks.signUp.mock.calls[0][0].options.data).not.toHaveProperty('app_role')
    expect(mocks.signUp.mock.calls[0][0].options.emailRedirectTo).toBe('https://lysto.test/auth/confirm')
  })
  it('allows customer registration while new service requests and payments are paused', async () => {
    vi.stubEnv('APP_ENV', 'production')
    vi.stubEnv('PAYMENTS_PROVIDER', 'disabled')
    vi.stubEnv('LYSTO_ACCEPT_NEW_REQUESTS', 'false')
    vi.stubEnv('LYSTO_ALLOW_NEW_CHECKOUTS', 'false')
    mocks.signUp.mockResolvedValue({ error: null })

    expect((await registerAction(initial, form(signup))).status).toBe('success')
    expect(mocks.signUp).toHaveBeenCalledOnce()
  })
  it('sends customers through safe profile completion', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { user: { id: 'user', app_metadata: { app_role: 'customer' } } }, error: null })
    mocks.read.mockResolvedValue('/completar-perfil?next=%2Fapp')
    await expect(loginAction(initial, form({ email: signup.email, password: signup.password, next: 'https://evil.test' }))).rejects.toThrow('REDIRECT:/completar-perfil?next=%2Fapp')
    expect(mocks.read.mock.calls[0][0]).toBe('/app')
  })
  it('rejects staff accounts in public customer login', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { user: { id: 'user', app_metadata: { app_role: 'admin' } } }, error: null })
    expect((await loginAction(initial, form(signup))).status).toBe('error')
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
  it('retains MFA for staff entry', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { user: { id: 'user', app_metadata: { app_role: 'admin' } } }, error: null })
    mocks.rpc.mockResolvedValue({ data: { role: 'admin', professional_status: null, professional_eligible: false, aal: 'aal1' }, error: null })
    await expect(staffLogin(initial, form(signup))).rejects.toThrow('REDIRECT:/seguridad?next=%2Fadmin')
  })
  it('does not reveal recovery account existence even on provider errors', async () => {
    mocks.resetPasswordForEmail.mockRejectedValue(new Error('unknown account'))
    expect(await recoverPasswordAction(initial, form({ email: 'ana@example.com' }))).toMatchObject({ status: 'success', message: expect.stringContaining('Si existe una cuenta') })
  })
  it('rejects cross-origin login and OAuth before provider calls', async () => {
    mocks.origin.mockRejectedValue(new Error('origin'))
    expect((await loginAction(initial, form(signup))).status).toBe('error')
    expect((await googleAuthAction(initial, form({ next: '/app' }))).status).toBe('error')
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled()
  })
  it('keeps Google OAuth disabled even if Supabase enables its provider later', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { google: true } }) }))
    mocks.signInWithOAuth.mockResolvedValue({ data: { url: 'https://accounts.google.com/' }, error: null })

    expect((await googleAuthAction(initial, form({ next: '/app' }))).status).toBe('error')
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled()
  })
})
