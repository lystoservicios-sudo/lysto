import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), is: vi.fn(), order: vi.fn(), maybeSingle: vi.fn(), bootstrap: vi.fn(), signOut: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({ auth: { getUser: mocks.user, signOut: mocks.signOut }, from: mocks.from, rpc: mocks.rpc }) }))
vi.mock('@/lib/auth/account-server', () => ({ bootstrapVerifiedCustomer: mocks.bootstrap }))
import { readCustomerSession, resolvedCustomerDestination } from '@/lib/auth/customer-session'
const profile = { id: '11111111-1111-4111-8111-111111111111', role: 'customer', first_name: 'Ana', last_name: 'Pérez', phone: '+541122334455' }
const address = { id: '22222222-2222-4222-8222-222222222222', street: 'San Martín', number: '932', city: 'Vicente López', province: 'Buenos Aires', property_type: 'house' }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.user.mockResolvedValue({ data: { user: { id: 'user-id', email_confirmed_at: '2026-01-01', app_metadata: { app_role: 'customer' } } }, error: null })
  mocks.bootstrap.mockResolvedValue('ready')
  mocks.rpc.mockResolvedValue({ data: { role: 'customer', profile_id: profile.id, customer_id: '33333333-3333-4333-8333-333333333333', session_active: true, session_id: '44444444-4444-4444-8444-444444444444' }, error: null })
  for (const name of ['from', 'select', 'eq', 'is'] as const) mocks[name].mockReturnValue(mocks)
  mocks.order.mockReturnValueOnce(mocks).mockResolvedValue({ data: [address], error: null })
  mocks.maybeSingle.mockResolvedValue({ data: profile, error: null })
})
describe('progressive customer readiness with fresh authority', () => {
  it('routes OAuth without accepted policy to completion before reading domain profiles', async () => {
    mocks.bootstrap.mockResolvedValue('incomplete')
    expect(await resolvedCustomerDestination('/app/solicitar/aire-acondicionado')).toBe('/completar-cuenta?next=%2Fapp%2Fsolicitar%2Faire-acondicionado')
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('does not bootstrap an unverified email', async () => {
    mocks.user.mockResolvedValue({ data: { user: { app_metadata: { app_role: 'customer' }, email_confirmed_at: null } }, error: null })
    expect(await resolvedCustomerDestination()).toBe('/login?notice=confirm-email')
    expect(mocks.bootstrap).not.toHaveBeenCalled()
  })
  it('checks a fresh active server session rather than trusting role metadata alone', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect(await readCustomerSession()).toEqual({ kind: 'unavailable' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('excludes archived addresses and preserves a complete customer destination', async () => {
    expect(await resolvedCustomerDestination('/app/solicitar/aire-acondicionado')).toBe('/app/solicitar/aire-acondicionado')
    expect(mocks.is).toHaveBeenCalledWith('archived_at', null)
  })
  it('requires profile completion when no active address remains', async () => {
    mocks.order.mockReset().mockReturnValueOnce(mocks).mockResolvedValue({ data: [], error: null })
    expect(await resolvedCustomerDestination()).toBe('/completar-perfil?next=%2Fapp')
  })
  it('fails closed when current session authority is unavailable', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'network' } })
    await expect(readCustomerSession()).rejects.toThrow('customer_session_unavailable')
  })
})
