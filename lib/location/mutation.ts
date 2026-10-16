import 'server-only'

import { verifyLocationProof } from './proof'

type GeographicAddress = { street: string; number: string; city: string; province: string }
type AddressMutation = GeographicAddress & { locationProof?: string }

function comparable(value: string) {
  return value.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR')
}

function sameLocation(input: GeographicAddress, existing: GeographicAddress) {
  return (['street', 'number', 'city', 'province'] as const).every((key) => comparable(input[key]) === comparable(existing[key]))
}

export function canonicalizeAddressMutation<T extends AddressMutation>(input: T, existing: GeographicAddress | null, secret?: string) {
  const { locationProof = '', ...data } = input
  if (existing && sameLocation(data, existing) && !locationProof) return {
    ...data, street: existing.street, number: existing.number, city: existing.city, province: existing.province
  }
  if (!locationProof) throw new Error('location_selection_required')
  const selected = verifyLocationProof(locationProof, data, secret)
  return { ...data, street: selected.street, number: selected.number, city: selected.city, province: selected.province }
}
