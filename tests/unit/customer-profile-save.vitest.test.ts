import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ read: vi.fn(), from: vi.fn(), update: vi.fn(), insert: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn(), single: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({ from: mocks.from }) }))
vi.mock('@/lib/auth/customer-session', () => ({ readCustomerSession: mocks.read }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
import { completeProfileAction } from '../../app/(auth)/completar-perfil/actions'
const profile = { id: 'profile-id', first_name: 'Ana', last_name: 'Pérez', phone: '+541112345678' }
const address = { id: 'address-id', street: 'Corrientes', number: '1234', city: 'Buenos Aires', province: 'Buenos Aires', property_type: 'apartment' }
const session = { kind: 'customer', verified: true, customer: { id: 'customer-id' }, profile, address }
const initial = { status: 'idle' as const, email: '', message: '' }
beforeEach(() => {
  vi.resetAllMocks()
  for (const key of ['from', 'update', 'insert', 'eq', 'select'] as const) mocks[key].mockReturnValue(mocks)
  mocks.maybeSingle.mockResolvedValue({ data: { id: 'saved-id' }, error: null })
  mocks.single.mockResolvedValue({ data: { id: 'saved-id' }, error: null })
})
describe('profile persistence', () => {
  it('rejects invalid input without writing to the database', async () => {
    mocks.read.mockResolvedValue({ ...session, address: null })
    expect(await completeProfileAction(initial, new FormData())).toMatchObject({ status: 'error' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('requires a verified customer session', async () => {
    mocks.read.mockResolvedValue({ ...session, verified: false })
    expect(await completeProfileAction(initial, new FormData())).toMatchObject({ status: 'error' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('saves only the missing profile section, preserves known identity, and rechecks saved state', async () => {
    mocks.read.mockResolvedValueOnce({ ...session, profile: { ...profile, phone: '' } }).mockResolvedValueOnce(session)
    const form = new FormData(); form.set('phone', profile.phone); form.set('first_name', 'Tampered'); form.set('next', '/app/solicitar/aire-acondicionado')
    await expect(completeProfileAction(initial, form)).rejects.toThrow('REDIRECT:/app/solicitar/aire-acondicionado')
    expect(mocks.update).toHaveBeenCalledWith({ first_name: 'Ana', last_name: 'Pérez', phone: profile.phone })
    expect(mocks.eq).toHaveBeenCalledWith('id', 'profile-id')
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.read).toHaveBeenCalledTimes(2)
  })
  it('does not pretend a denied database update succeeded', async () => {
    mocks.read.mockResolvedValue({ ...session, profile: { ...profile, phone: '' } })
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    const form = new FormData(); form.set('phone', profile.phone)
    expect(await completeProfileAction(initial, form)).toMatchObject({ status: 'error' })
  })
  it('inserts the missing address for the authenticated customer only', async () => {
    mocks.read.mockResolvedValueOnce({ ...session, address: null }).mockResolvedValueOnce(session)
    const form = new FormData(); Object.entries(address).forEach(([key, value]) => form.set(key, value)); form.set('customer_id', 'someone-else')
    await expect(completeProfileAction(initial, form)).rejects.toThrow('REDIRECT:/app')
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ customer_id: 'customer-id', street: 'Corrientes', is_default: true }))
  })
})
