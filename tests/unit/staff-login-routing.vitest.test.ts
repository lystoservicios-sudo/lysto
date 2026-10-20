// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Children, isValidElement, type ReactNode } from 'react'
const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), rpc: vi.fn(), path: '/admin/pagos' }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({ auth: { getClaims: mocks.getClaims }, rpc: mocks.rpc }) }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-lysto-path': mocks.path }) }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) }, notFound: () => { throw new Error('NOT_FOUND') } }))
import { requirePageSession } from '@/lib/auth/session'
import { professionalInvitationToken } from '@/lib/auth/session-routing'
import StaffLoginPage from '@/app/(auth)/equipo/login/page'
import { LoginForm } from '@/app/(auth)/login/login-form'
function loginProps(children: ReactNode) {
  const form = Children.toArray(children).find(child => isValidElement(child) && child.type === LoginForm)
  expect(form).toBeDefined()
  if (!isValidElement<{ staff?: boolean; next?: string }>(form)) throw new Error('Missing login form')
  return form.props
}
beforeEach(() => { vi.resetAllMocks(); mocks.getClaims.mockResolvedValue({ data: { claims: null }, error: { code: 'bad_jwt' } }); mocks.path = '/admin/pagos' })

describe('staff session recovery keeps the correct login surface', () => {
  it('accepts only the exact token-bearing professional onboarding destination', () => {
    const token = 'a'.repeat(43)
    expect(professionalInvitationToken(`/pro/onboarding/${token}`)).toBe(token)
    expect(professionalInvitationToken(`/pro/onboarding/${token}?extra=1`)).toBeNull()
    expect(professionalInvitationToken(`/pro/onboarding/${'a'.repeat(42)}`)).toBeNull()
    expect(professionalInvitationToken('/admin/dashboard')).toBeNull()
  })
  it.each([
    ['admin', '/admin/pagos', '/equipo/login?next=%2Fadmin%2Fpagos'],
    ['professional', '/pro/agenda', '/equipo/login?next=%2Fpro%2Fagenda'],
    ['admin', '/pro/agenda', '/equipo/login?next=%2Fadmin%2Fdashboard'],
    ['professional', '//attacker.test', '/equipo/login?next=%2Fpro%2Fdashboard']
  ] as const)('returns an unauthenticated %s to the staff login with a bounded destination', async (role, path, expected) => {
    mocks.path = path
    await expect(requirePageSession(role)).rejects.toThrow(`REDIRECT:${expected}`)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('keeps customer authentication on the commercial login', async () => {
    mocks.path = '/app/trabajos'
    await expect(requirePageSession('customer')).rejects.toThrow('REDIRECT:/login')
  })
  it.each(['/admin/pagos', '/pro/agenda'])('preserves %s through the staff login page', async next => {
    const page = await StaffLoginPage({ searchParams: Promise.resolve({ next }) })
    expect(loginProps(page.props.children)).toMatchObject({ staff: true, next })
  })
  it.each(['/pro/onboarding', `/pro/onboarding/${'a'.repeat(43)}`])('uses focused invitation access only for %s', async next => {
    const page = await StaffLoginPage({ searchParams: Promise.resolve({ next }) })
    expect(page.type).toBe('main')
    expect(page.props.children.props).toMatchObject({ token: next === '/pro/onboarding' ? undefined : 'a'.repeat(43) })
    expect(page.props.children.type.name).toBe('InvitationEntry')
  })
  it.each(['https://attacker.test', '//attacker.test', '/app', '/admin/../../app'])('does not carry an unsafe or customer next into the staff flow: %s', async next => {
    const page = await StaffLoginPage({ searchParams: Promise.resolve({ next }) })
    const actual = loginProps(page.props.children).next
    expect([undefined, '/admin/dashboard']).toContain(actual)
  })
  it('shows password recovery success alongside the staff login', async () => {
    const page = await StaffLoginPage({ searchParams: Promise.resolve({ reset: 'success', next: '/pro/agenda' }) })
    expect(loginProps(page.props.children)).toMatchObject({ staff: true, next: '/pro/agenda' })
    const notice = Children.toArray(page.props.children).find(child => isValidElement<{ role?: string }>(child) && child.props.role === 'status')
    expect(isValidElement<{ children: ReactNode }>(notice) && notice.props.children).toBeTruthy()
  })
})
