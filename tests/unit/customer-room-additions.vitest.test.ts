import { describe, expect, it } from 'vitest'
import { roomAdditionSlots } from '@/lib/customer-homes/room-additions'
import type { HomeFloor, HomeRoom } from '@/lib/customer-homes/contracts'

const room: HomeRoom = { id: 'living', name: 'Living', kind: 'living', variant: 'compact', x: 0, z: 0, width: 4, depth: 4, rotation: 0, windows: 'small' }
const floor = (rooms: HomeRoom[]): HomeFloor => ({ id: 'floor', name: 'Planta baja', order: 0, rooms })

describe('visual room locations', () => {
  it('offers all four sides of a standalone room', () => {
    const slots = roomAdditionSlots(floor([room]))
    expect(slots.map(({ side, x, z }) => [side, x, z])).toEqual([
      ['north', 0, -4.15], ['east', 4.15, 0], ['south', 0, 4.15], ['west', -4.15, 0]
    ])
  })
  it('does not offer a location occupied by another room', () => {
    const slots = roomAdditionSlots(floor([room, { ...room, id: 'neighbor', x: 4.15 }]))
    expect(slots.find(slot => slot.roomId === room.id && slot.side === 'east')).toBeUndefined()
    expect(slots.find(slot => slot.roomId === 'neighbor' && slot.side === 'west')).toBeUndefined()
  })
  it('uses rotated dimensions and centers new rooms on the chosen side', () => {
    const slots = roomAdditionSlots(floor([{ ...room, width: 6, depth: 2, rotation: 90 }]))
    expect(slots.find(slot => slot.side === 'east')).toMatchObject({ x: 2.15, z: 1 })
    expect(slots.find(slot => slot.side === 'south')).toMatchObject({ x: -1, z: 6.15 })
  })
  it('respects coordinate and room count limits', () => {
    expect(roomAdditionSlots(floor([{ ...room, x: -80 }])).some(slot => slot.side === 'west')).toBe(false)
    expect(roomAdditionSlots(floor(Array.from({ length: 60 }, (_, i) => ({ ...room, id: String(i) }))))).toEqual([])
    expect(roomAdditionSlots(floor([]))).toEqual([])
  })
})
