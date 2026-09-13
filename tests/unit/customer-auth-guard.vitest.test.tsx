import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('@/lib/auth/customer-session', () => ({ readCustomerSession: mocks.read }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-lysto-path': '/app/solicitar/aire-acondicionado' }) }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
vi.mock('@/components/layout/page-shell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }))
import CustomerLayout from '../../app/(customer)/app/layout'
beforeEach(() => vi.resetAllMocks())
describe('customer app guard', () => {
  it('redirects unauthenticated visits to login with an internal destination', async () => {
    mocks.read.mockResolvedValue({ kind: 'anonymous' })
    await expect(Promise.resolve().then(() => CustomerLayout({ children: 'private' }))).rejects.toThrow('REDIRECT:/login?next=%2Fapp%2Fsolicitar%2Faire-acondicionado')
  })
  it('blocks direct entry until missing profile information is saved', async () => {
    mocks.read.mockResolvedValue({ kind: 'customer', verified: true, profile: { first_name: 'Ana', last_name: 'Pérez', phone: null }, address: null })
    await expect(Promise.resolve().then(() => CustomerLayout({ children: 'private' }))).rejects.toThrow('REDIRECT:/completar-perfil?next=%2Fapp%2Fsolicitar%2Faire-acondicionado')
  })
  it('does not expose the app when the profile cannot be loaded', async () => {
    mocks.read.mockRejectedValue(new Error('database down'))
    await expect(Promise.resolve().then(() => CustomerLayout({ children: 'private' }))).rejects.toThrow('REDIRECT:/login?notice=unavailable')
  })
})

