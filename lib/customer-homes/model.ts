import { ROOM_CATALOG, type CustomerHome, type EquipmentPlacement, type HomeFloor, type HomeKind, type HomeRoom, type RoomKind } from './contracts'

export function roomLabel(kind: RoomKind) { return ROOM_CATALOG[kind].label }
export function roomVariants(kind: RoomKind) { return ROOM_CATALOG[kind].variants }
export function roomKindsForHome(kind: HomeKind) { return (Object.keys(ROOM_CATALOG) as RoomKind[]).filter(room => ROOM_CATALOG[room].homeKinds.includes(kind as never)) }
export function createHomeFloor(kind: HomeKind, idFactory: () => string = () => crypto.randomUUID()): HomeFloor {
  const rooms: [RoomKind, string][] = kind === 'office' ? [['office', 'shared'], ['meeting', 'compact'], ['reception', 'lounge'], ['bathroom', 'compact']]
    : kind === 'commercial' ? [['commercial', 'retail'], ['reception', 'compact'], ['storage', 'utility'], ['bathroom', 'compact']]
    : [['bedroom', 'principal'], ['bathroom', 'shower'], ['living', kind === 'house' ? 'family' : 'compact'], ['kitchen', kind === 'house' ? 'island' : kind === 'ph' ? 'l' : 'linear']]
  return { id: idFactory(), name: 'Planta baja', order: 0, rooms: rooms.map(([roomKind, variant], index) => ({ id: idFactory(), name: roomLabel(roomKind), kind: roomKind, variant, x: index % 2 * 4.15, z: Math.floor(index / 2) * 4.15, width: 4, depth: 4, rotation: 0, windows: roomKind === 'bathroom' || roomKind === 'storage' ? 'small' : 'large' })) }
}
export function addHomeRoom(floor: HomeFloor, kind: RoomKind, variant = ROOM_CATALOG[kind].variants[0].value, id = crypto.randomUUID()): HomeFloor {
  if (floor.rooms.length >= 60) throw new Error('Esta planta admite hasta 60 ambientes.')
  if (!ROOM_CATALOG[kind].variants.some(v => v.value === variant)) throw new Error('Variante de ambiente inválida.')
  const width = 4, depth = 4
  let x = 0, z = 0, found = false
  for (let row = 0; row < 18 && !found; row++) for (let col = 0; col < 18 && !found; col++) {
    x = col * 4.15; z = row * 4.15
    found = !floor.rooms.some(room => {
      const rw = room.rotation % 180 ? room.depth : room.width, rd = room.rotation % 180 ? room.width : room.depth
      return x < room.x + rw + .05 && x + width + .05 > room.x && z < room.z + rd + .05 && z + depth + .05 > room.z
    })
  }
  if (!found) throw new Error('No queda espacio en esta planta. Añadí otra planta.')
  return { ...floor, rooms: [...floor.rooms, { id, name: roomLabel(kind), kind, variant, x, z, width, depth, rotation: 0, windows: 'small' }] }
}
export function removeHomeRoom<T extends Pick<CustomerHome, 'floors' | 'placements'>>(home: T, roomId: string): T {
  return { ...home, floors: home.floors.map(f => ({ ...f, rooms: f.rooms.filter(r => r.id !== roomId) })), placements: home.placements.filter(p => p.roomId !== roomId) }
}
export function removeHomeFloor<T extends Pick<CustomerHome, 'floors' | 'placements'>>(home: T, floorId: string): T {
  if (home.floors.length <= 1) throw new Error('Conservá al menos una planta.')
  const removedIds = new Set(home.floors.find(f => f.id === floorId)?.rooms.map(r => r.id) ?? [])
  return { ...home, floors: home.floors.filter(f => f.id !== floorId).map((f, order) => ({ ...f, order })), placements: home.placements.filter(p => !removedIds.has(p.roomId)) }
}
export function equipmentForHome<T extends { addressId: string | null; archivedAt?: string | null }>(home: Pick<CustomerHome, 'addressId' | 'addressIds'>, equipment: T[]): T[] {
  const addressIds = new Set(home.addressIds ?? [home.addressId])
  return equipment.filter(e => !e.archivedAt && (e.addressId === null || addressIds.has(e.addressId)))
}
export function unplacedEquipmentForHome<T extends { id: string; addressId: string | null; archivedAt?: string | null }>(home: CustomerHome, equipment: T[], homes: CustomerHome[]): T[] {
  const placedIds = new Set(homes.flatMap(h => h.placements.map(p => p.equipmentId)))
  return equipmentForHome(home, equipment).filter(e => !placedIds.has(e.id))
}
export function clampPlacement(room: HomeRoom, placement: EquipmentPlacement): EquipmentPlacement {
  // offset spans the useful wall segment; rendering applies equipment-width margins.
  return { ...placement, roomId: room.id, offset: Math.max(0, Math.min(1, placement.offset)), height: Math.max(.35, Math.min(2.5, placement.height)) }
}
