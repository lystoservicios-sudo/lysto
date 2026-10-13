import { describe, expect, it } from 'vitest'
import { createHomeSchema, saveHomeSchema, ROOM_CATALOG, HOME_KIND_OPTIONS } from '@/lib/customer-homes/contracts'
import { createHomeFloor, addHomeRoom, removeHomeRoom, removeHomeFloor, equipmentForHome, unplacedEquipmentForHome, clampPlacement } from '@/lib/customer-homes/model'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const floor = { id: id(2), name: 'Planta baja', order: 0, rooms: [{ id: id(3), name: 'Living', kind: 'living', variant: 'compact', x: 0, z: 0, width: 4, depth: 4, rotation: 0, windows: 'small' }] }
const input = { name: 'Mi casa', addressId: id(1), kind: 'house', building: null, features: { balcony: false, terrace: true, windows: 'mixed' }, floors: [floor], placements: [] }
const home = () => saveHomeSchema.parse({ ...input, id: id(4), expectedVersion: 1 })

describe('Hogar contracts and catalogue', () => {
  it('accepts the five approved kinds without conflating PH with postal property type', () => {
    expect(HOME_KIND_OPTIONS.map(option => option.value)).toEqual(['house', 'apartment', 'ph', 'office', 'commercial'])
    for (const kind of HOME_KIND_OPTIONS.map(option => option.value)) expect(createHomeSchema.safeParse({ ...input, kind, floors: [{ ...floor, rooms: [] }], idempotencyKey: id(5) }).success).toBe(true)
  })
  it('provides distinct editable variants for every room kind', () => {
    expect(Object.keys(ROOM_CATALOG)).toHaveLength(16)
    for (const room of Object.values(ROOM_CATALOG)) expect(new Set(room.variants.map(v => v.value)).size).toBeGreaterThanOrEqual(2)
  })
  it('rejects arbitrary fields and unrecognized variants', () => {
    expect(createHomeSchema.safeParse({ ...input, customerId: id(6), idempotencyKey: id(5) }).success).toBe(false)
    expect(saveHomeSchema.safeParse({ ...input, id: id(4), expectedVersion: 1, floors: [{ ...floor, rooms: [{ ...floor.rooms[0], variant: 'fake' }] }] }).success).toBe(false)
  })
  it('rejects duplicate identities, overlapping rooms and foreign room placements', () => {
    const save = { ...input, id: id(4), expectedVersion: 1 }
    expect(saveHomeSchema.safeParse({ ...save, floors: [floor, floor] }).success).toBe(false)
    expect(saveHomeSchema.safeParse({ ...save, floors: [{ ...floor, rooms: [floor.rooms[0], { ...floor.rooms[0], id: id(7) }] }] }).success).toBe(false)
    expect(saveHomeSchema.safeParse({ ...save, placements: [{ equipmentId: id(8), roomId: id(99), wall: 'north', offset: .5, height: 2 }] }).success).toBe(false)
  })
  it('requires optimistic versions and bounded placements', () => {
    expect(saveHomeSchema.safeParse({ ...input, id: id(4), expectedVersion: 0 }).success).toBe(false)
    expect(saveHomeSchema.safeParse({ ...input, id: id(4), expectedVersion: 1, placements: [{ equipmentId: id(8), roomId: id(3), wall: 'west', offset: 1.3, height: 2 }] }).success).toBe(false)
  })
  it('rejects room kinds incompatible with a property and undeclared outdoor spaces', () => {
    expect(createHomeSchema.safeParse({ ...input, kind: 'office', idempotencyKey: id(5) }).success).toBe(false)
    expect(createHomeSchema.safeParse({ ...input, idempotencyKey: id(5), floors: [{ ...floor, rooms: [{ ...floor.rooms[0], kind: 'balcony', variant: 'wide' }] }] }).success).toBe(false)
  })
  it('accepts a new address inline instead of an existing address identity', () => {
    const newAddress = { label: 'Casa nueva', street: 'Corrientes', number: '123', city: 'CABA', province: 'CABA', propertyType: 'house', access: {}, isDefault: false }
    expect(createHomeSchema.safeParse({ ...input, addressId: null, newAddress, idempotencyKey: id(5) }).success).toBe(true)
  })
  it('requires exactly one owned existing address or a valid new address', () => {
    const newAddress = { label: 'Casa nueva', street: 'Corrientes', number: '123', city: 'CABA', province: 'CABA', propertyType: 'house', access: {}, isDefault: false }
    expect(createHomeSchema.safeParse({ ...input, addressId: null, idempotencyKey: id(5) }).success).toBe(false)
    expect(createHomeSchema.safeParse({ ...input, newAddress, idempotencyKey: id(5) }).success).toBe(false)
    expect(createHomeSchema.safeParse({ ...input, addressId: null, newAddress: { ...newAddress, customerId: id(99) }, idempotencyKey: id(5) }).success).toBe(false)
  })
})

describe('Hogar model operations', () => {
  it('creates a curated editable floor for every home kind with no equipment invented', () => {
    for (const kind of HOME_KIND_OPTIONS.map(o => o.value)) {
      let counter = 10
      const initial = createHomeFloor(kind, () => id(counter++))
      expect(initial.rooms.length).toBeGreaterThan(0)
      expect(createHomeSchema.safeParse({ ...input, kind, floors: [initial], idempotencyKey: id(5) }).success).toBe(true)
    }
  })
  it('adds rooms without overlap or a demo six-room limit', () => {
    let value = home()
    for (let n = 10; n < 18; n++) value = { ...value, floors: value.floors.map(f => f.id === id(2) ? addHomeRoom(f, 'bedroom', 'principal', id(n)) : f) }
    expect(value.floors[0].rooms).toHaveLength(9)
    expect(saveHomeSchema.safeParse(value).success).toBe(true)
  })
  it('removing a room clears placement without altering equipment identities', () => {
    const value = { ...home(), placements: [{ equipmentId: id(8), roomId: id(3), wall: 'north' as const, offset: .5, height: 2 }] }
    const result = removeHomeRoom(value, id(3))
    expect(result.floors[0].rooms).toEqual([])
    expect(result.placements).toEqual([])
  })
  it('removing a floor clears only its placements and retains another floor', () => {
    const value = { ...home(), floors: [floor, { id: id(10), name: 'Planta alta', order: 1, rooms: [] }], placements: [{ equipmentId: id(8), roomId: id(3), wall: 'north' as const, offset: .5, height: 2 }] }
    const result = removeHomeFloor(value as ReturnType<typeof home>, id(2))
    expect(result.floors.map(f => f.id)).toEqual([id(10)])
    expect(result.placements).toEqual([])
    expect(() => removeHomeFloor(home(), id(2))).toThrow()
  })
  it('uses explicit address aliases and unassigned ownership instead of matching address text', () => {
    const equipment = [{ id: id(8), addressId: id(1), archivedAt: null }, { id: id(9), addressId: id(7), archivedAt: null }, { id: id(10), addressId: null, archivedAt: null }, { id: id(11), addressId: id(99), archivedAt: null }]
    expect(equipmentForHome({ ...home(), addressIds: [id(1), id(7)] }, equipment).map(e => e.id)).toEqual([id(8), id(9), id(10)])
  })
  it('clamps wall offsets to a visibly usable boundary and height inside the wall', () => {
    const room = home().floors[0].rooms[0]
    expect(clampPlacement(room, { equipmentId: id(8), roomId: id(3), wall: 'north', offset: -.5, height: 20 }).offset).toBe(0)
    expect(clampPlacement(room, { equipmentId: id(8), roomId: id(3), wall: 'north', offset: 0, height: 20 }).height).toBeLessThanOrEqual(2.5)
  })
  it('does not offer unassigned equipment already placed at another home', () => {
    const equipment = [{ id: id(8), addressId: null, archivedAt: null }, { id: id(9), addressId: null, archivedAt: null }]
    const current = { ...home(), version: 1 }
    const other = { ...current, id: id(99), placements: [{ equipmentId: id(8), roomId: id(3), wall: 'north' as const, offset: .5, height: 2 }] }
    expect(unplacedEquipmentForHome(current, equipment, [current, other]).map(e => e.id)).toEqual([id(9)])
  })
})
