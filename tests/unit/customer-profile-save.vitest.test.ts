import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), origin: vi.fn(), role: vi.fn() }))
vi.mock('@/lib/auth/customer-session', () => ({ readCustomerSession: mocks.read }))
vi.mock('@/lib/auth/account-server', () => ({ assertAccountMutationOrigin: mocks.origin }))
vi.mock('@/lib/auth/session', () => ({ requireRole: mocks.role }))
vi.mock('@/lib/security/rate-limit', () => ({ enforceRateLimit: vi.fn() }))
vi.mock('@/lib/customer-assets/service', () => ({ writeCustomerAsset: mocks.write }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
import { completeProfileAction } from '../../app/(auth)/completar-perfil/actions'
import { issueLocationProof } from '@/lib/location/proof'
const profile = { id: 'profile-id', first_name: 'Ana', last_name: 'Pérez', phone: '+541112345678', version: 3, notification_preference: 'email' }
const address = { id: 'address-id', label: 'Casa', street: 'Corrientes', number: '1234', city: 'Buenos Aires', province: 'Buenos Aires', property_type: 'apartment', version: 2 }
const session = { kind: 'customer', verified: true, customer: { id: 'customer-id' }, profile, address }
const authority = { profileId: profile.id, customerId: 'customer-id', client: {}, role: 'customer' }
const initial = { status: 'idle' as const, email: '', message: '' }
const proofSecret = 'customer-profile-location-proof-secret'
beforeEach(() => { vi.resetAllMocks(); process.env.LOCATION_PROOF_SECRET = proofSecret; mocks.role.mockResolvedValue(authority); mocks.write.mockResolvedValue({ saved: true }) })
describe('profile persistence through guarded versioned assets', () => {
  it('rejects invalid input without writing', async () => {
    mocks.read.mockResolvedValue({ ...session, address: null })
    expect(await completeProfileAction(initial, new FormData())).toMatchObject({ status: 'error' })
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it('requires an allowed origin before resolving authority', async () => {
    mocks.origin.mockRejectedValue(new Error('origin'))
    expect(await completeProfileAction(initial, new FormData())).toMatchObject({ status: 'error' })
    expect(mocks.role).not.toHaveBeenCalled()
  })
  it('requires a verified customer matching fresh session authority', async () => {
    mocks.read.mockResolvedValue({ ...session, profile: { ...profile, id: 'other-person' } })
    expect(await completeProfileAction(initial, new FormData())).toMatchObject({ status: 'error' })
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it('preserves known identity and uses expected version before rereading', async () => {
    mocks.read.mockResolvedValueOnce({ ...session, profile: { ...profile, phone: '' } }).mockResolvedValueOnce(session)
    const form = new FormData(); form.set('phone', profile.phone); form.set('first_name', 'Tampered'); form.set('next', '/app/solicitar/aire-acondicionado')
    await expect(completeProfileAction(initial, form)).rejects.toThrow('REDIRECT:/app/solicitar/aire-acondicionado')
    expect(mocks.write).toHaveBeenCalledWith(authority, 'profile', { firstName: 'Ana', lastName: 'Pérez', phone: profile.phone, notificationPreference: 'email' }, profile.id, 3)
    expect(mocks.read).toHaveBeenCalledTimes(2)
  })
  it('does not pretend a stale or denied write succeeded', async () => {
    mocks.read.mockResolvedValue({ ...session, profile: { ...profile, phone: '' } })
    mocks.write.mockRejectedValue(new Error('conflict'))
    const form = new FormData(); form.set('phone', profile.phone)
    expect(await completeProfileAction(initial, form)).toMatchObject({ status: 'error' })
  })
  it('creates an address with session ownership and ignores submitted owner ids', async () => {
    mocks.read.mockResolvedValueOnce({ ...session, address: null }).mockResolvedValueOnce(session)
    const form = new FormData(); Object.entries(address).forEach(([key, value]) => form.set(key, String(value))); form.set('customer_id', 'someone-else')
    form.set('location_proof', issueLocationProof({ street: address.street, number: address.number, city: address.city, province: address.province, provinceId: '06', cityId: '06014010', streetId: '0601401000001', formattedAddress: 'Corrientes 1234, Buenos Aires, Argentina', latitude: -34.6, longitude: -58.4, precision: 'rooftop', source: 'georef_google' }, proofSecret))
    await expect(completeProfileAction(initial, form)).rejects.toThrow('REDIRECT:/app')
    expect(mocks.write).toHaveBeenCalledWith(authority, 'address', expect.objectContaining({ street: 'Corrientes', isDefault: true }), null, null)
    expect(mocks.write.mock.calls[0][2]).not.toHaveProperty('customer_id')
  })
  it('updates all geographic fields from the verified selection when an existing address is partial', async () => {
    const selected = { street: 'SAN MARTIN', number: '123', city: 'Córdoba', province: 'Córdoba' }
    mocks.read.mockResolvedValueOnce({ ...session, address: { ...address, number: '' } })
      .mockResolvedValueOnce({ ...session, address: { ...address, ...selected } })
    const form = new FormData()
    Object.entries({ ...selected, first_name: 'Tampered', property_type: 'house' }).forEach(([key, value]) => form.set(key, value))
    form.set('location_proof', issueLocationProof({ ...selected, provinceId: '14', cityId: '14014010', streetId: '1401401000123',
      formattedAddress: 'SAN MARTIN 123, Córdoba, Córdoba, Argentina', latitude: -31.4167, longitude: -64.1833,
      precision: 'range_interpolated', source: 'georef' }, proofSecret))
    await expect(completeProfileAction(initial, form)).rejects.toThrow('REDIRECT:/app')
    expect(mocks.write).toHaveBeenCalledTimes(1)
    expect(mocks.write).toHaveBeenCalledWith(authority, 'address', expect.objectContaining({
      ...selected, propertyType: 'apartment', label: 'Casa'
    }), address.id, address.version)
  })
  it('saves only the missing property type without requesting or replacing the existing geographic selection', async () => {
    mocks.read.mockResolvedValueOnce({ ...session, address: { ...address, property_type: '' } })
      .mockResolvedValueOnce({ ...session, address: { ...address, property_type: 'house' } })
    const form = new FormData()
    Object.entries({ street: 'Tampered', number: '456', city: 'Córdoba', province: 'Córdoba', property_type: 'house' }).forEach(([key, value]) => form.set(key, value))
    await expect(completeProfileAction(initial, form)).rejects.toThrow('REDIRECT:/app')
    expect(mocks.write).toHaveBeenCalledTimes(1)
    expect(mocks.write).toHaveBeenCalledWith(authority, 'address', expect.objectContaining({
      street: address.street, number: address.number, city: address.city, province: address.province, propertyType: 'house'
    }), address.id, address.version)
  })
})
