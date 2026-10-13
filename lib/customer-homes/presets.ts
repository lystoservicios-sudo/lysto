import type { HomeFeatures, HomeFloor, HomeKind } from './contracts'
import { addHomeRoom, createHomeFloor } from './model'

export function createHomePreset(kind: HomeKind, features: HomeFeatures, idFactory: () => string = () => crypto.randomUUID()): HomeFloor[] {
  let floor = createHomeFloor(kind, idFactory)
  floor = { ...floor, rooms: floor.rooms.map(room => ({ ...room, windows: room.kind === 'bathroom' || room.kind === 'storage' ? 'small' : features.windows === 'mixed' ? 'large' : features.windows })) }
  if (features.balcony) floor = addHomeRoom(floor, 'balcony', 'wide', idFactory())
  if (features.terrace) floor = addHomeRoom(floor, 'terrace', 'open', idFactory())
  return [floor]
}
