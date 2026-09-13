import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ signUp: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(), read: vi.fn(), resetPasswordForEmail: vi.fn(), updateUser: vi.fn(), getUser: vi.fn(), signInWithOAuth: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({ auth: mocks }) }))
vi.mock('@/lib/auth/customer-session', () => ({ resolvedCustomerDestination: mocks.read }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
import { loginAction } from '../../app/(auth)/login/actions'
import { registerAction, recoverPasswordAction, updatePasswordAction, googleAuthAction } from '../../app/(auth)/actions'
const initial = { status: 'idle' as const, email: '', message: '' }
function form(values: Record<string, string>) { const data = new FormData(); Object.entries(values).forEach(([k,v]) => data.set(k,v)); return data }
beforeEach(() => { vi.resetAllMocks(); process.env.NEXT_PUBLIC_APP_URL = 'https://lysto.test' })
describe('customer authentication server actions', () => {
  it('does not call auth for invalid registration', async () => {
    const result = await registerAction(initial, form({ email: 'invalid', password: 'short' }))
    expect(result.status).toBe('error')
    expect(mocks.signUp).not.toHaveBeenCalled()
  })
  it('creates an account with personal data and asks for email confirmation', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null, user: { id: 'user' } }, error: null })
    const result = await registerAction(initial, form({ email: 'ANA@example.com', password: 'a-password-123', confirmPassword: 'a-password-123', firstName: 'Ana', lastName: 'Pérez', next: '/app/solicitar/aire-acondicionado' }))
    expect(result.status).toBe('success')
    expect(mocks.signUp.mock.calls[0][0]).toMatchObject({ email: 'ana@example.com', options: { data: { first_name: 'Ana', last_name: 'Pérez' } } })
    expect(mocks.signUp.mock.calls[0][0].options.data).not.toHaveProperty('role')
    expect(mocks.signUp.mock.calls[0][0].options.emailRedirectTo).toContain('/auth/callback?next=')
  })
  it('sends authenticated customers through the completion gate', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { user: { id: 'user' } }, error: null })
    mocks.read.mockResolvedValue('/completar-perfil?next=%2Fapp')
    await expect(loginAction(initial, form({ email: 'ana@example.com', password: 'a-password-123', next: 'https://evil.test' }))).rejects.toThrow('REDIRECT:/completar-perfil?next=%2Fapp')
    expect(mocks.read.mock.calls[0][0]).toBe('/app')
  })
  it('does not reveal whether a recovery email exists', async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null })
    const result = await recoverPasswordAction(initial, form({ email: 'ana@example.com' }))
    expect(result.status).toBe('success')
    expect(result.message).toContain('Si existe una cuenta')
  })
  it('refuses password updates without a validated session', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const result = await updatePasswordAction(initial, form({ password: 'a-password-123', confirmPassword: 'a-password-123' }))
    expect(result.status).toBe('error')
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })
  it('returns an honest error when Google is unavailable', async () => {
    mocks.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { code: 'provider_disabled' } })
    expect(await googleAuthAction(initial, form({ next: '/app' }))).toMatchObject({ status: 'error' })
  })
})
