import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), page: vi.fn(), identity: vi.fn() }))
vi.mock('@/lib/auth/customer-session', () => ({ resolvedCustomerDestination: mocks.resolve }))
vi.mock('@/lib/auth/session', () => ({ requirePageSession: mocks.page }))
vi.mock('@/lib/auth/account-identity', () => ({ readAccountIdentity: mocks.identity }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-lysto-path': '/app/solicitar/aire-acondicionado' }) }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
vi.mock('@/components/layout/page-shell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }))
import CustomerLayout from '../../app/(customer)/app/layout'
beforeEach(() => vi.resetAllMocks())
describe('customer app guard', () => {
  it.each(['/login?next=%2Fapp', '/completar-cuenta?next=%2Fapp', '/completar-perfil?next=%2Fapp'])('blocks direct entry with onboarding destination %s', async (destination) => {
    mocks.resolve.mockResolvedValue(destination)
    await expect(CustomerLayout({ children: 'private' })).rejects.toThrow(`REDIRECT:${destination}`)
    expect(mocks.page).not.toHaveBeenCalled()
  })
  it('retains the hardened session boundary after onboarding', async () => {
    mocks.resolve.mockResolvedValue('/app/solicitar/aire-acondicionado')
    mocks.page.mockResolvedValue({ role: 'customer' })
    await CustomerLayout({ children: 'private' })
    expect(mocks.page).toHaveBeenCalledWith('customer')
  })
  it('fails closed when profile data cannot be loaded', async () => {
    mocks.resolve.mockRejectedValue(new Error('database down'))
    await expect(CustomerLayout({ children: 'private' })).rejects.toThrow('database down')
    expect(mocks.page).not.toHaveBeenCalled()
  })
})
