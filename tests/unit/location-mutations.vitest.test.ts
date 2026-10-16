import { describe, expect, it } from 'vitest'

import { issueLocationProof } from '@/lib/location/proof'
import { canonicalizeAddressMutation } from '@/lib/location/mutation'
import type { ResolvedAddress } from '@/lib/location/contracts'

const secret = 'this-is-a-long-location-proof-test-secret'
const selected: ResolvedAddress = {
  street: 'AV RIVADAVIA', number: '1234', city: 'San Nicolás', province: 'CABA',
  provinceId: '02', cityId: '02007010', streetId: '0200701000085',
  formattedAddress: 'Av. Rivadavia 1234, CABA, Argentina', latitude: -34.6, longitude: -58.4,
  precision: 'rooftop', source: 'georef_google'
}
const base = { label: 'Casa', street: 'Av Rivadavia', number: '1234', city: 'San Nicolás', province: 'CABA', propertyType: 'apartment' as const, access: {}, isDefault: true }

describe('canonical address mutations', () => {
  it('requires a selected location for a new address and persists canonical names', () => {
    expect(() => canonicalizeAddressMutation({ ...base, locationProof: '' }, null, secret)).toThrow('location_selection_required')
    const locationProof = issueLocationProof(selected, secret)
    expect(canonicalizeAddressMutation({ ...base, locationProof }, null, secret)).toMatchObject({
      street: 'AV RIVADAVIA', number: '1234', city: 'San Nicolás', province: 'CABA'
    })
  })

  it('allows an existing exact address when only secondary data changed', () => {
    expect(canonicalizeAddressMutation({ ...base, street: 'AV RIVADAVIA', city: 'san nicolas', label: 'Oficina', locationProof: '' }, base, secret)).toMatchObject({
      label: 'Oficina', street: base.street, city: base.city
    })
  })

  it('requires a fresh selection when geographic fields changed', () => {
    expect(() => canonicalizeAddressMutation({ ...base, number: '999', locationProof: '' }, base, secret)).toThrow('location_selection_required')
  })
})
