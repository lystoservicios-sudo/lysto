import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), from: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({ auth: { getUser: mocks.user }, from: mocks.from, rpc: mocks.rpc }) }))
vi.mock('@/lib/auth/customer-session', () => ({ readCustomerSession: mocks.session }))
import { getPricingSession } from '@/lib/pricing/server'
import { POST as submit } from '@/app/api/customer/request/submit/route'
const complete = { kind: 'customer', verified: true, profile: { first_name: 'Ana', last_name: 'Pérez', phone: '+541122334455' }, address: { street: 'San Martín', number: '932', city: 'Vicente López', province: 'Buenos Aires', property_type: 'house' } }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.user.mockResolvedValue({ data: { user: { id: 'user-id', email_confirmed_at: '2026-01-01', app_metadata: { app_role: 'customer' } } }, error: null })
  mocks.from.mockImplementation((table: string) => ({ select: () => ({ eq: () => ({ single: async () => ({ data: table === 'profiles' ? { id: 'profile-id', role: 'customer' } : { id: 'customer-id' }, error: null }) }) }) }))
  mocks.session.mockResolvedValue(complete)
})
describe('service request readiness', () => {
  it('blocks incomplete customer profiles before request creation', async () => {
    mocks.session.mockResolvedValue({ ...complete, profile: { ...complete.profile, phone: '' } })
    await expect(getPricingSession({ requireCompleteCustomer: true })).rejects.toThrow('customer_profile_incomplete')
  })
  it('blocks unverified email even if the profile is complete', async () => {
    mocks.session.mockResolvedValue({ ...complete, verified: false })
    await expect(getPricingSession({ requireCompleteCustomer: true })).rejects.toThrow('customer_email_unverified')
  })
  it('allows complete customers and keeps read-only session checks independent from onboarding', async () => {
    expect((await getPricingSession({ requireCompleteCustomer: true })).customerId).toBe('customer-id')
    mocks.session.mockResolvedValue({ ...complete, address: null })
    expect((await getPricingSession()).customerId).toBe('customer-id')
  })
  it('returns a useful 403 and never calls the submit RPC for an incomplete profile', async () => {
    mocks.session.mockResolvedValue({ ...complete, profile: { ...complete.profile, phone: '' } })
    const response = await submit(new Request('https://lysto.test/api/customer/request/submit', { method: 'POST', body: JSON.stringify({ quoteId: '01010101-0101-4101-8101-010101010101' }) }))
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'customer_profile_incomplete', next: '/completar-perfil' })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
