// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), rpc: vi.fn(), path: '/admin/pagos' }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({ auth: { getClaims: mocks.getClaims }, rpc: mocks.rpc }) }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-lysto-path': mocks.path }) }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) }, notFound: () => { throw new Error('NOT_FOUND') } }))
import { requirePageSession } from '@/lib/auth/session'
import StaffLoginPage from '@/app/(auth)/equipo/login/page'
beforeEach(() => { vi.resetAllMocks(); mocks.getClaims.mockResolvedValue({ data: { claims: null }, error: { code: 'bad_jwt' } }); mocks.path = '/admin/pagos' })

describe('staff session recovery keeps the correct login surface', () => {
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
    expect(page.props.children.props).toMatchObject({ staff: true, next })
  })
  it.each(['https://attacker.test', '//attacker.test', '/app', '/admin/../../app'])('does not carry an unsafe or customer next into the staff flow: %s', async next => {
    const page = await StaffLoginPage({ searchParams: Promise.resolve({ next }) })
    const actual = page.props.children.props.next
    expect([undefined, '/admin/dashboard']).toContain(actual)
  })
})
