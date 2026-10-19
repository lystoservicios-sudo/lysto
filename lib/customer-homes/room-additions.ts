import type { HomeFloor, HomeRoom } from './contracts'

export type RoomAdditionSlot = {
  id: string
  roomId: string
  side: 'north' | 'east' | 'south' | 'west'
  label: string
  x: number
  z: number
  markerX: number
  markerZ: number
}

const round = (value: number) => Math.round(value * 100) / 100
const dimensions = (room: HomeRoom) => room.rotation % 180
  ? { width: room.depth, depth: room.width }
  : { width: room.width, depth: room.depth }

/** Positions are in floor coordinates; the scene projects their markers with its camera. */
export function roomAdditionSlots(floor: HomeFloor): RoomAdditionSlot[] {
  if (floor.rooms.length >= 60) return []
  return floor.rooms.flatMap(room => {
    const { width, depth } = dimensions(room)
    const cx = room.x + width / 2, cz = room.z + depth / 2
    const candidates: RoomAdditionSlot[] = [
      { side: 'north', x: cx - 2, z: room.z - 4.15, markerX: cx, markerZ: room.z - .8, label: `Añadir ambiente detrás de ${room.name}` },
      { side: 'east', x: room.x + width + .15, z: cz - 2, markerX: room.x + width + .8, markerZ: cz, label: `Añadir ambiente a la derecha de ${room.name}` },
      { side: 'south', x: cx - 2, z: room.z + depth + .15, markerX: cx, markerZ: room.z + depth + .8, label: `Añadir ambiente delante de ${room.name}` },
      { side: 'west', x: room.x - 4.15, z: cz - 2, markerX: room.x - .8, markerZ: cz, label: `Añadir ambiente a la izquierda de ${room.name}` }
    ].map(slot => ({ ...slot, side: slot.side as RoomAdditionSlot['side'], id: `${room.id}:${slot.side}`, roomId: room.id, x: round(slot.x), z: round(slot.z) }))
    return candidates.filter(slot => Math.abs(slot.x) <= 80 && Math.abs(slot.z) <= 80 && !floor.rooms.some(other => {
      const size = dimensions(other)
      return slot.x < other.x + size.width - .01 && slot.x + 4 > other.x + .01 && slot.z < other.z + size.depth - .01 && slot.z + 4 > other.z + .01
    }))
  })
}
