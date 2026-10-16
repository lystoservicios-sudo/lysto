'use client'

import { z } from 'zod'
import { addHomeEquipmentSchema, createHomeMutationSchema, saveHomeSchema, type CustomerHome, type CustomerHomesSnapshot } from '@/lib/customer-homes/contracts'
import { addressInputSchema, addressMutationUpdateSchema } from '@/lib/customer-assets/contracts'
import type { CustomerAssetEquipment } from '@/lib/customer-assets/contracts'
import { privateRequest } from '@/lib/http/private-client'

const commandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('create-home'), input: createHomeMutationSchema }).strict(),
  z.object({ kind: z.literal('add-equipment'), input: addHomeEquipmentSchema }).strict(),
  z.object({ kind: z.literal('save-home'), input: saveHomeSchema }).strict(),
  z.object({ kind: z.literal('save-address'), input: addressMutationUpdateSchema }).strict()
])
export type RequestHomeCommand = z.infer<typeof commandSchema>
type ReplayResult = { home?: CustomerHome; equipment?: CustomerAssetEquipment }
const storageKey = (actor: string) => `lysto:pedir:location:${actor}`
export function readRequestHomeCommand(actor: string): { command: RequestHomeCommand | null; error: string } {
  try {
    const raw = window.sessionStorage.getItem(storageKey(actor))
    return { command: raw ? commandSchema.parse(JSON.parse(raw)) : null, error: '' }
  } catch { return { command: null, error: 'No pudimos recuperar el guardado de ubicación pendiente. No registres otro hogar o equipo hasta revisar el pendiente.' } }
}
export function storeRequestHomeCommand(actor: string, command: RequestHomeCommand) {
  z.string().uuid().parse(actor)
  const serialized = JSON.stringify(commandSchema.parse(command))
  try {
    window.sessionStorage.setItem(storageKey(actor), serialized)
    if (window.sessionStorage.getItem(storageKey(actor)) !== serialized) throw new Error('storage')
  } catch { throw new Error('Habilitá el almacenamiento de esta pestaña antes de guardar. Todavía no enviamos la operación.') }
}
export function clearRequestHomeCommand(actor: string) { try { window.sessionStorage.removeItem(storageKey(actor)) } catch { /* Resolve via exact retry. */ } }
export function homeSaveInput(home: CustomerHome) {
  const { id, version, name, addressId, kind, building, features, floors, placements } = home
  return { id, expectedVersion: version, name, addressId, kind, building, features, floors, placements }
}
/** A versioned PUT cannot apply once the authenticated target has advanced.
 * This does not assert that the old desired write was ever applied.
 */
export function locationCommandWasSuperseded(command: RequestHomeCommand, snapshot: CustomerHomesSnapshot): boolean {
  if (command.kind !== 'save-home' && command.kind !== 'save-address') return false
  const target = command.kind === 'save-home'
    ? snapshot.homes.find(home => home.id === command.input.id)
    : snapshot.addresses.find(address => address.id === command.input.id && !address.archivedAt)
  return !!target && Number.isInteger(target.version) && target.version > command.input.expectedVersion
}
/** Canonicalize field order, preserving command identity, actual values and array order. */
export function sameRequestHomeCommand(left: RequestHomeCommand | null, right: RequestHomeCommand): boolean {
  const stored = commandSchema.safeParse(left), wanted = commandSchema.safeParse(right)
  return stored.success && wanted.success && JSON.stringify(stored.data) === JSON.stringify(wanted.data)
}
function matchesSavedHome(home: CustomerHome, command: Extract<RequestHomeCommand, { kind: 'save-home' }>) {
  const payload = (value: ReturnType<typeof homeSaveInput>) => {
    // Zod gives nested objects canonical key order; arrays and actual geometry remain unchanged.
    const parsed = saveHomeSchema.parse(value)
    return { name: parsed.name, addressId: parsed.addressId, kind: parsed.kind, building: parsed.building, features: parsed.features, floors: parsed.floors, placements: parsed.placements }
  }
  const wanted = payload(command.input)
  const actual = payload(homeSaveInput(home))
  return JSON.stringify(actual) === JSON.stringify(wanted)
}
/** Mirrors write_customer_asset: blank/omitted optional text becomes NULL and omitted flags stay unknown. */
function savedAddressSnapshot(value: z.infer<typeof addressInputSchema>) {
  const optional = (text: string | null | undefined) => text?.trim() || null
  return {
    label: value.label.trim(), street: value.street.trim(), number: value.number.trim(),
    city: value.city.trim(), province: value.province.trim(), propertyType: value.propertyType,
    floor: optional(value.floor), apartment: optional(value.apartment),
    postalCode: optional(value.postalCode), reference: optional(value.reference),
    isDefault: value.isDefault ?? false,
    access: {
      hasElevator: value.access.hasElevator ?? null, hasParking: value.access.hasParking ?? null,
      stairsRequired: value.access.stairsRequired ?? null, outdoorUnitAtHeight: value.access.outdoorUnitAtHeight ?? null,
      outdoorUnitOnBalcony: value.access.outdoorUnitOnBalcony ?? null, difficultAccess: value.access.difficultAccess ?? null
    }
  }
}
/** A versioned PUT has no RPC idempotency key: reconcile its exact desired snapshot before retrying. */
export async function replayRequestHomeCommand(actor: string, command: RequestHomeCommand, uncertain = false): Promise<ReplayResult> {
  const headers = { 'X-Lysto-Customer-Id': actor }
  if (uncertain && (command.kind === 'save-home' || command.kind === 'save-address')) {
    const data = await privateRequest<CustomerHomesSnapshot>('/api/customer/homes', 'GET', undefined, headers)
    if (command.kind === 'save-home') {
      const home = data.homes.find(h => h.id === command.input.id)
      if (!home) throw new Error('El hogar ya no está disponible. Revisá la información antes de continuar.')
      if (home.version > command.input.expectedVersion && matchesSavedHome(home, command)) return { home }
      if (home.version !== command.input.expectedVersion) throw new Error('La ubicación cambió desde otro lugar. Recargá los datos antes de continuar; no repetimos un guardado diferente.')
    } else {
      const address = data.addresses.find(a => a.id === command.input.id)
      if (!address) throw new Error('La dirección ya no está disponible.')
      const matches = JSON.stringify(savedAddressSnapshot(address)) === JSON.stringify(savedAddressSnapshot(command.input))
      if (address.version > command.input.expectedVersion && matches) return {}
      if (address.version !== command.input.expectedVersion) throw new Error('La dirección cambió desde otro lugar. Revisala antes de continuar.')
    }
  }
  let outbound = command
  if (uncertain && command.kind === 'create-home' && command.input.newAddress?.locationProof) {
    const address = command.input.newAddress
    const renewed = await privateRequest<{ proof: string }>('/api/location/renew', 'POST', {
      proof: address.locationProof, street: address.street, number: address.number, city: address.city, province: address.province
    }, headers)
    outbound = { ...command, input: { ...command.input, newAddress: { ...address, locationProof: renewed.proof } } }
  } else if (uncertain && command.kind === 'save-address' && command.input.locationProof) {
    const address = command.input
    const renewed = await privateRequest<{ proof: string }>('/api/location/renew', 'POST', {
      proof: address.locationProof, street: address.street, number: address.number, city: address.city, province: address.province
    }, headers)
    outbound = { ...command, input: { ...command.input, locationProof: renewed.proof } }
  }
  const path = command.kind === 'add-equipment' ? '/api/customer/homes/equipment' : command.kind === 'save-address' ? '/api/customer/addresses' : '/api/customer/homes'
  const method = command.kind === 'save-home' || command.kind === 'save-address' ? 'PUT' : 'POST'
  const result = await privateRequest<ReplayResult>(path, method, outbound.input, headers)
  return result
}
