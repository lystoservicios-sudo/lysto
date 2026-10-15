import { describe, expect, it } from 'vitest'
import type { CustomerAssetAddress, CustomerAssetEquipment } from '@/lib/customer-assets/contracts'
import type { CustomerHome, CustomerHomesSnapshot } from '@/lib/customer-homes/contracts'
import { listRequestEquipment, resolveRequestContext, selectRequestFloor } from '@/features/service-request/request-context'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const address = (patch: Partial<CustomerAssetAddress> = {}): CustomerAssetAddress => ({
  id: id(1), version: 1, label: 'Casa', street: 'Corrientes', number: '123', city: 'CABA', province: 'CABA', propertyType: 'house', access: {}, isDefault: false, createdAt: '2026-10-13T00:00:00Z', archivedAt: null, ...patch
})
const equipment = (patch: Partial<CustomerAssetEquipment> = {}): CustomerAssetEquipment => ({
  id: id(8), nickname: 'Aire del living', addressId: id(1), equipmentType: 'inverter', brand: 'Marca', model: null, serialNumber: null, frigorias: '6000', version: 2, createdAt: '2026-10-13T00:00:00Z', archivedAt: null, ...patch
})
const home = (patch: Partial<CustomerHome> = {}): CustomerHome => ({
  id: id(4), version: 3, name: 'Mi casa', kind: 'house', building: null, addressId: id(1), addressIds: [id(1), id(7)], features: { balcony: false, terrace: false, windows: 'small' },
  floors: [{ id: id(2), name: 'Nivel jardín', order: 0, rooms: [{ id: id(3), name: 'Living', kind: 'living', variant: 'compact', x: 0, z: 0, width: 4, depth: 4, rotation: 0, windows: 'small' }] }],
  placements: [{ equipmentId: id(8), roomId: id(3), wall: 'west', offset: .25, height: 2.1 }], ...patch
})
const snapshot = (patch: Partial<CustomerHomesSnapshot> = {}): CustomerHomesSnapshot => ({ homes: [home()], addresses: [address()], equipment: [equipment()], ...patch })

describe('request equipment choices', () => {
  it('offers only active equipment from the supplied actor-bound inventory, retaining its identity and nickname', () => {
    const choices = listRequestEquipment(snapshot({ equipment: [equipment(), equipment({ id: id(9), nickname: 'Oficina', archivedAt: '2026-10-12T00:00:00Z' })] }))
    expect(choices).toHaveLength(1)
    expect(choices[0]).toMatchObject({ id: id(8), nickname: 'Aire del living', addressId: id(1), version: 2, capacity: 6000, technology: 'inverter', capacityCoverage: 'supported' })
  })
  it.each(['split', 'window', 'floor_ceiling', 'central', null])('does not infer a compressor technology from %s', (equipmentType) => {
    expect(listRequestEquipment(snapshot({ equipment: [equipment({ equipmentType })] }))[0].technology).toBe('unknown')
  })
  it('recognizes conventional equipment only from the explicit on_off type', () => {
    expect(listRequestEquipment(snapshot({ equipment: [equipment({ equipmentType: 'on_off' })] }))[0].technology).toBe('conventional')
  })
  it('retains capacities beyond pricing coverage instead of clamping them to 18000', () => {
    expect(listRequestEquipment(snapshot({ equipment: [equipment({ frigorias: '24000' })] }))[0]).toMatchObject({ capacity: 24000, capacityCoverage: 'outside' })
  })
  it.each([null, '', '6000 frigorías', 'NaN', '6000.5', '999'])('keeps invalid or unknown legacy capacity %s unresolved', (frigorias) => {
    expect(listRequestEquipment(snapshot({ equipment: [equipment({ frigorias })] }))[0]).toMatchObject({ capacity: null, capacityCoverage: 'unknown' })
  })
})

describe('request home context', () => {
  it('resolves actual room and wall placement without modifying the home snapshot', () => {
    const input = snapshot()
    const before = JSON.stringify(input)
    const context = resolveRequestContext(input, id(8))
    expect(context.kind).toBe('located')
    expect(context).toMatchObject({ home: { id: id(4), version: 3 }, address: { id: id(1) }, floor: { id: id(2), name: 'Nivel jardín' }, room: { id: id(3) }, placement: { wall: 'west', offset: .25, height: 2.1 } })
    expect(JSON.stringify(input)).toBe(before)
  })
  it('resolves historical address aliases by identity and returns the current visit address', () => {
    const context = resolveRequestContext(snapshot({ equipment: [equipment({ addressId: id(7) })] }), id(8))
    expect(context.kind).toBe('located')
    expect(context.address?.id).toBe(id(1))
    expect(context.equipment?.addressId).toBe(id(7))
  })
  it('does not associate two places merely because their address text matches', () => {
    const context = resolveRequestContext(snapshot({ equipment: [equipment({ addressId: id(99) })], homes: [home({ placements: [] })], addresses: [address(), address({ id: id(99) })] }), id(8))
    expect(context.kind).toBe('missing-home')
    expect(context.home).toBeNull()
    expect(context.address?.id).toBe(id(99))
  })
  it('distinguishes a home with an unplaced air from a fully located air', () => {
    const context = resolveRequestContext(snapshot({ homes: [home({ placements: [] })] }), id(8))
    expect(context.kind).toBe('unplaced')
    expect(context.home?.id).toBe(id(4))
    expect(context.floor).toBeNull()
    expect(context.room).toBeNull()
    expect(context.placement).toBeNull()
  })
  it('can resolve an existing placement for an air that has no legacy address link', () => {
    expect(resolveRequestContext(snapshot({ equipment: [equipment({ addressId: null })] }), id(8)).kind).toBe('located')
  })
  it('does not select a random home for an unassigned air', () => {
    const context = resolveRequestContext(snapshot({ equipment: [equipment({ addressId: null })], homes: [home({ placements: [] })] }), id(8))
    expect(context.kind).toBe('missing-home')
    expect(context.home).toBeNull()
    expect(context.address).toBeNull()
  })
  it('returns new for the explicit new-equipment choice without manufacturing any identity', () => {
    expect(resolveRequestContext(snapshot(), null)).toMatchObject({ kind: 'new', equipment: null, home: null, room: null, placement: null })
  })
  it('does not resolve an equipment ID absent from the active own inventory', () => {
    expect(resolveRequestContext(snapshot(), id(999))).toMatchObject({ kind: 'incomplete', reason: 'equipment_missing', equipment: null })
    expect(resolveRequestContext(snapshot({ equipment: [equipment({ archivedAt: '2026-10-12T00:00:00Z' })] }), id(8)).kind).toBe('incomplete')
  })
  it('keeps a missing or archived canonical visit address incomplete', () => {
    expect(resolveRequestContext(snapshot({ addresses: [] }), id(8))).toMatchObject({ kind: 'incomplete', reason: 'address_missing' })
    expect(resolveRequestContext(snapshot({ addresses: [address({ archivedAt: '2026-10-12T00:00:00Z' })] }), id(8)).kind).toBe('incomplete')
  })
  it('rejects a stale placement instead of creating a default room or wall', () => {
    const context = resolveRequestContext(snapshot({ homes: [home({ placements: [{ equipmentId: id(8), roomId: id(99), wall: 'west', offset: .25, height: 2.1 }] })] }), id(8))
    expect(context).toMatchObject({ kind: 'incomplete', reason: 'invalid_placement', room: null, placement: null })
  })
  it('rejects ambiguous homes or a placement whose address conflicts with the equipment', () => {
    expect(resolveRequestContext(snapshot({ homes: [home(), home({ id: id(20) })] }), id(8))).toMatchObject({ kind: 'incomplete', reason: 'ambiguous_home' })
    expect(resolveRequestContext(snapshot({ equipment: [equipment({ addressId: id(99) })] }), id(8))).toMatchObject({ kind: 'incomplete', reason: 'address_conflict' })
  })
})

describe('one-floor request viewer', () => {
  it('hides floor navigation when the home only has one floor', () => {
    expect(selectRequestFloor(home())).toMatchObject({ showSelector: false, activeFloor: { id: id(2), name: 'Nivel jardín' } })
  })
  it('sorts real floor names while selecting only the requested floor', () => {
    const input = home({ floors: [{ id: id(10), name: 'Entrepiso', order: 2, rooms: [] }, home().floors[0], { id: id(11), name: 'Nivel terraza', order: 1, rooms: [] }] })
    const selection = selectRequestFloor(input, id(10))
    expect(selection.showSelector).toBe(true)
    expect(selection.floors.map(floor => floor.name)).toEqual(['Nivel jardín', 'Nivel terraza', 'Entrepiso'])
    expect(selection.activeFloor?.id).toBe(id(10))
    expect(input.floors[0].id).toBe(id(10))
  })
  it('falls back to the first real floor if a selected floor was removed', () => {
    expect(selectRequestFloor(home(), id(999)).activeFloor?.id).toBe(id(2))
    expect(selectRequestFloor(home({ floors: [] })).activeFloor).toBeNull()
  })
})
