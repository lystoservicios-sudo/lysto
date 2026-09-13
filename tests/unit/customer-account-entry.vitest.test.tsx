import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), live: vi.fn(), profile: vi.fn(), addresses: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ requirePageSession: mocks.session }))
vi.mock('@/lib/customer/live-model', () => ({ customerLiveData: mocks.live }))
vi.mock('@/lib/customer-assets/service', () => ({ readCustomerProfile: mocks.profile, listCustomerAddresses: mocks.addresses }))
import CustomerDashboardPage from '../../app/(customer)/app/page'
import CustomerProfilePage from '../../app/(customer)/app/perfil/page'
import CustomerAddressesPage from '../../app/(customer)/app/direcciones/page'
const authority = { role: 'customer', profileId: 'test-owner' }
beforeEach(() => { vi.resetAllMocks(); mocks.session.mockResolvedValue(authority); mocks.live.mockResolvedValue({ dashboard: { greeting: 'Inés' } }); mocks.profile.mockResolvedValue({ firstName: 'Inés' }); mocks.addresses.mockResolvedValue({ items: [] }) })
describe('real customer account entry', () => {
  it('loads the dashboard exclusively from the current authorized customer', async () => {
    await CustomerDashboardPage()
    expect(mocks.session).toHaveBeenCalledWith('customer')
    expect(mocks.live).toHaveBeenCalledWith(authority)
  })
  it('loads editable profile and address data through guarded customer services', async () => {
    await CustomerProfilePage(); await CustomerAddressesPage()
    expect(mocks.profile).toHaveBeenCalledWith(authority)
    expect(mocks.addresses).toHaveBeenCalledWith(authority)
  })
  it('does not read another identity when the session is absent', async () => {
    mocks.session.mockRejectedValue(new Error('REDIRECT:/login'))
    await expect(CustomerDashboardPage()).rejects.toThrow('REDIRECT:/login')
    expect(mocks.live).not.toHaveBeenCalled()
  })
})
