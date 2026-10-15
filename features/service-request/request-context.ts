import type { CustomerAssetAddress, CustomerAssetEquipment } from '@/lib/customer-assets/contracts'
import type { CustomerHome, CustomerHomesSnapshot, EquipmentPlacement, HomeFloor, HomeRoom } from '@/lib/customer-homes/contracts'

export type RequestEquipmentTechnology = 'inverter' | 'conventional' | 'unknown'
export type RequestEquipment = Pick<CustomerAssetEquipment, 'id' | 'nickname' | 'addressId' | 'equipmentType' | 'brand' | 'model' | 'version'> & {
  capacity: number | null
  capacityCoverage: 'supported' | 'outside' | 'unknown'
  technology: RequestEquipmentTechnology
}

type EmptyLocation = { floor: null; room: null; placement: null }
type ContextBase = { equipment: RequestEquipment | null; address: CustomerAssetAddress | null; home: CustomerHome | null }
export type RequestContext =
  | (EmptyLocation & { kind: 'new'; equipment: null; address: null; home: null })
  | (EmptyLocation & ContextBase & { kind: 'incomplete'; reason: 'equipment_missing' | 'address_missing' | 'ambiguous_home' | 'invalid_placement' | 'address_conflict' })
  | (EmptyLocation & { kind: 'missing-home'; equipment: RequestEquipment; address: CustomerAssetAddress | null; home: null })
  | (EmptyLocation & { kind: 'unplaced'; equipment: RequestEquipment; address: CustomerAssetAddress; home: CustomerHome })
  | { kind: 'located'; equipment: RequestEquipment; address: CustomerAssetAddress; home: CustomerHome; floor: HomeFloor; room: HomeRoom; placement: EquipmentPlacement }

/** The inventory must come from the authenticated customer's homes snapshot. */
export function listRequestEquipment(snapshot: CustomerHomesSnapshot): RequestEquipment[] {
  return snapshot.equipment.filter(equipment => !equipment.archivedAt).map(equipment => {
    const rawCapacity = equipment.frigorias?.trim() ?? ''
    const parsedCapacity = /^\d+$/.test(rawCapacity) ? Number(rawCapacity) : NaN
    const capacity = Number.isSafeInteger(parsedCapacity) && parsedCapacity >= 1000 ? parsedCapacity : null
    return {
      id: equipment.id, nickname: equipment.nickname, addressId: equipment.addressId, equipmentType: equipment.equipmentType,
      brand: equipment.brand, model: equipment.model, version: equipment.version, capacity,
      capacityCoverage: capacity === null ? 'unknown' : capacity > 18000 ? 'outside' : 'supported',
      technology: equipment.equipmentType === 'inverter' ? 'inverter' : equipment.equipmentType === 'on_off' ? 'conventional' : 'unknown'
    }
  })
}

const emptyLocation: EmptyLocation = { floor: null, room: null, placement: null }
const addressIdsForHome = (home: CustomerHome) => new Set([home.addressId, ...(home.addressIds ?? [])])

/** Never match postal strings or invent a room/placement for a legacy air. */
export function resolveRequestContext(snapshot: CustomerHomesSnapshot, equipmentId: string | null): RequestContext {
  if (equipmentId === null) return { kind: 'new', equipment: null, address: null, home: null, ...emptyLocation }
  const equipment = listRequestEquipment(snapshot).find(item => item.id === equipmentId) ?? null
  if (!equipment) return { kind: 'incomplete', reason: 'equipment_missing', equipment: null, address: null, home: null, ...emptyLocation }
  const activeAddresses = snapshot.addresses.filter(address => !address.archivedAt)
  const equipmentAddress = activeAddresses.find(address => address.id === equipment.addressId) ?? null
  const placedHomes = snapshot.homes.filter(home => home.placements.some(placement => placement.equipmentId === equipment.id))
  const matchingHomes = placedHomes.length ? placedHomes : snapshot.homes.filter(home => equipment.addressId !== null && addressIdsForHome(home).has(equipment.addressId))
  if (matchingHomes.length > 1) return { kind: 'incomplete', reason: 'ambiguous_home', equipment, address: equipmentAddress, home: null, ...emptyLocation }
  const home = matchingHomes[0]
  if (!home) {
    if (equipment.addressId !== null && !equipmentAddress) return { kind: 'incomplete', reason: 'address_missing', equipment, address: null, home: null, ...emptyLocation }
    return { kind: 'missing-home', equipment, address: equipmentAddress, home: null, ...emptyLocation }
  }
  const address = activeAddresses.find(item => item.id === home.addressId) ?? null
  if (equipment.addressId !== null && !addressIdsForHome(home).has(equipment.addressId)) return { kind: 'incomplete', reason: 'address_conflict', equipment, address, home, ...emptyLocation }
  if (!address) return { kind: 'incomplete', reason: 'address_missing', equipment, address: null, home, ...emptyLocation }
  const placements = home.placements.filter(item => item.equipmentId === equipment.id)
  if (!placements.length) return { kind: 'unplaced', equipment, address, home, ...emptyLocation }
  const placement = placements[0]
  const floor = home.floors.find(item => item.rooms.some(room => room.id === placement.roomId))
  const room = floor?.rooms.find(item => item.id === placement.roomId)
  if (placements.length !== 1 || !floor || !room) return { kind: 'incomplete', reason: 'invalid_placement', equipment, address, home, ...emptyLocation }
  return { kind: 'located', equipment, address, home, floor, room, placement }
}

export function selectRequestFloor(home: CustomerHome, floorId?: string | null): { floors: HomeFloor[]; activeFloor: HomeFloor | null; showSelector: boolean } {
  const floors = [...home.floors].sort((left, right) => left.order - right.order)
  return { floors, activeFloor: floors.find(floor => floor.id === floorId) ?? floors[0] ?? null, showSelector: floors.length > 1 }
}
