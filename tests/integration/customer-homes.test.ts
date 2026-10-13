import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createFixtureAccounts } from './fixtures'
import type { CustomerHome } from '../../lib/customer-homes/contracts'

// Fixture helper refuses production. Every account/row belongs to this disposable run.
describe('persistent customer Hogar ownership and layouts', () => {
  let pending: ReturnType<typeof createFixtureAccounts>
  let fixture: Awaited<ReturnType<typeof createFixtureAccounts>>
  beforeAll(async () => { pending = createFixtureAccounts({ mfa: false }); fixture = await pending }, 180000)
  afterAll(async () => { await pending?.cleanup() }, 180000)
  const addressData = () => ({ label: `Hogar ${randomUUID().slice(0, 8)}`, street: 'Dirección de prueba', number: '123', city: 'CABA', province: 'CABA', propertyType: 'apartment', access: {}, isDefault: false })
  const room = () => ({ id: randomUUID(), name: 'Dormitorio', kind: 'bedroom', variant: 'principal', x: 0, z: 0, width: 4, depth: 4, rotation: 0, windows: 'large' })
  async function createHome(actor: 'customerA' | 'customerB' = 'customerA') {
    const client = fixture.accounts[actor].client
    const address = await client.rpc('write_customer_asset', { p_kind: 'address', p_id: null, p_expected_version: null, p_data: addressData(), p_archive: false })
    expect(address.error).toBeNull()
    const input = { name: 'Hogar de prueba', addressId: address.data.address.id, kind: 'apartment', building: 'high', features: { balcony: false, terrace: false, windows: 'large' }, floors: [{ id: randomUUID(), name: 'Planta baja', order: 0, rooms: [room()] }], placements: [], idempotencyKey: randomUUID() }
    const created = await client.rpc('write_customer_home', { p_operation: 'create', p_id: null, p_expected_version: null, p_data: input })
    expect(created.error).toBeNull()
    return { home: created.data.home as CustomerHome, input, address: address.data.address }
  }
  const saveData = (home: CustomerHome) => ({ name: home.name, addressId: home.addressId, kind: home.kind, building: home.building, features: home.features, floors: home.floors, placements: home.placements })
  it('persists rooms and reloads only the current owner snapshot', async () => {
    const { home } = await createHome()
    const other = await createHome('customerB')
    const snapshot = await fixture.accounts.customerA.client.rpc('read_customer_homes')
    expect(snapshot.error).toBeNull()
    expect(snapshot.data.homes.map((h: CustomerHome) => h.id)).toContain(home.id)
    expect(snapshot.data.homes.map((h: CustomerHome) => h.id)).not.toContain(other.home.id)
    expect(snapshot.data.homes.find((h: CustomerHome) => h.id === home.id).floors).toEqual(home.floors)
    const denied = await fixture.accounts.customerB.client.rpc('write_customer_home', { p_operation: 'save', p_id: home.id, p_expected_version: home.version, p_data: saveData(home) })
    expect(denied.error?.code).toBe('P0002')
    const read = await fixture.accounts.customerB.client.from('customer_homes').select('id').eq('id', home.id)
    expect(read.data).toEqual([])
  })
  it('rejects direct writes, mixed home identities, stale versions and overlaps', async () => {
    const { home } = await createHome()
    const { home: other } = await createHome('customerB')
    const actor = fixture.accounts.customerA.client
    expect((await actor.from('customer_homes').update({ name: 'Bypass' }).eq('id', home.id)).error?.code).toBe('42501')
    const foreignFloor = await actor.rpc('write_customer_home', { p_operation: 'save', p_id: home.id, p_expected_version: 1, p_data: { ...saveData(home), floors: other.floors } })
    expect(foreignFloor.error?.code).toBe('P0002')
    const overlapped = await actor.rpc('write_customer_home', { p_operation: 'save', p_id: home.id, p_expected_version: 1, p_data: { ...saveData(home), floors: [{ ...home.floors[0], rooms: [home.floors[0].rooms[0], { ...home.floors[0].rooms[0], id: randomUUID() }] }] } })
    expect(overlapped.error?.code).toBe('22023')
    const valid = await actor.rpc('write_customer_home', { p_operation: 'save', p_id: home.id, p_expected_version: 1, p_data: { ...saveData(home), name: 'Nombre editado' } })
    expect(valid.error).toBeNull()
    expect(valid.data.home.version).toBe(2)
    expect((await actor.rpc('write_customer_home', { p_operation: 'save', p_id: home.id, p_expected_version: 1, p_data: saveData(home) })).error?.code).toBe('40001')
  })
  it('replays home creation and equipment registration without duplicates', async () => {
    const { home, input } = await createHome()
    const actor = fixture.accounts.customerA.client
    const retry = await actor.rpc('write_customer_home', { p_operation: 'create', p_id: null, p_expected_version: null, p_data: input })
    expect(retry.error).toBeNull()
    expect(retry.data.home.id).toBe(home.id)
    const data = { idempotencyKey: randomUUID(), equipment: { nickname: 'Aire de prueba', equipmentType: 'inverter' }, placement: { roomId: home.floors[0].rooms[0].id, wall: 'north', offset: .5, height: 2 } }
    const result = await actor.rpc('write_customer_home', { p_operation: 'equipment', p_id: home.id, p_expected_version: 1, p_data: data })
    expect(result.error).toBeNull()
    const repeated = await actor.rpc('write_customer_home', { p_operation: 'equipment', p_id: home.id, p_expected_version: 1, p_data: data })
    expect(repeated.error).toBeNull()
    expect(repeated.data.equipment.id).toBe(result.data.equipment.id)
    expect(repeated.data.home.placements).toHaveLength(1)
    expect((await actor.rpc('write_customer_home', { p_operation: 'equipment', p_id: home.id, p_expected_version: 2, p_data: { ...data, equipment: { nickname: 'Otro', equipmentType: 'split' } } })).error?.code).toBe('40001')
    const invalid = await actor.rpc('write_customer_home', { p_operation: 'equipment', p_id: home.id, p_expected_version: 2, p_data: { ...data, idempotencyKey: randomUUID(), placement: { ...data.placement, roomId: randomUUID() } } })
    expect(invalid.error?.code).toBe('P0002')
    const inventory = await actor.from('customer_equipment').select('id').eq('address_id', home.addressId)
    expect(inventory.data).toHaveLength(1)
  })
  it('creates a home and its new address atomically and replays the original inline command', async () => {
    const actor = fixture.accounts.customerA.client
    const newAddress = addressData()
    const data = { name: 'Creación atómica', addressId: null, newAddress, kind: 'house', building: null, features: { balcony: false, terrace: false, windows: 'large' }, floors: [{ id: randomUUID(), name: 'Planta baja', order: 0, rooms: [room()] }], placements: [], idempotencyKey: randomUUID() }
    const created = await actor.rpc('write_customer_home', { p_operation: 'create', p_id: null, p_expected_version: null, p_data: data })
    expect(created.error).toBeNull()
    expect(created.data.home.addressId).toBe(created.data.address.id)
    const retried = await actor.rpc('write_customer_home', { p_operation: 'create', p_id: null, p_expected_version: null, p_data: data })
    expect(retried.error).toBeNull()
    expect(retried.data).toEqual(created.data)
    expect((await actor.from('customer_addresses').select('id').eq('label', newAddress.label)).data).toHaveLength(1)
    const invalidAddress = addressData()
    const failed = await actor.rpc('write_customer_home', { p_operation: 'create', p_id: null, p_expected_version: null, p_data: { ...data, newAddress: invalidAddress, floors: [], idempotencyKey: randomUUID() } })
    expect(failed.error?.code).toBe('22023')
    expect((await actor.from('customer_addresses').select('id').eq('label', invalidAddress.label)).data).toEqual([])
    expect((await actor.rpc('write_customer_home', { p_operation: 'create', p_id: null, p_expected_version: null, p_data: { ...data, addressId: created.data.address.id } })).error?.code).toBe('40001')
  })
  it('does not adopt a floor identity during concurrent create commands from two owners', async () => {
    const actors = [fixture.accounts.customerA.client, fixture.accounts.customerB.client]
    const addresses = await Promise.all(actors.map(actor => actor.rpc('write_customer_asset', { p_kind: 'address', p_id: null, p_expected_version: null, p_data: addressData(), p_archive: false })))
    expect(addresses.every(result => result.error === null)).toBe(true)
    const sharedFloor = randomUUID()
    const results = await Promise.all(actors.map((actor, index) => actor.rpc('write_customer_home', { p_operation: 'create', p_id: null, p_expected_version: null, p_data: {
      name: `Concurrent home ${index}`, addressId: addresses[index].data.address.id, kind: 'house', building: null, features: { balcony: false, terrace: false, windows: 'small' }, floors: [{ id: sharedFloor, name: `Owner ${index} floor`, order: 0, rooms: [] }], placements: [], idempotencyKey: randomUUID()
    } })))
    expect(results.filter(result => result.error === null)).toHaveLength(1)
    expect(results.find(result => result.error)?.error?.code).toBe('P0002')
    const winner = results.findIndex(result => result.error === null)
    expect(results[winner].data.home.floors).toHaveLength(1)
    const visible = await Promise.all(actors.map(actor => actor.from('customer_home_floors').select('id,name,home_id').eq('id', sharedFloor)))
    expect(visible[winner].data).toEqual([{ id: sharedFloor, name: `Owner ${winner} floor`, home_id: results[winner].data.home.id }])
    expect(visible[1 - winner].data).toEqual([])
  })
  it('preserves address revisions and historical equipment address while removing a room', async () => {
    const { home, address } = await createHome()
    const actor = fixture.accounts.customerA.client
    const registration = await actor.rpc('write_customer_home', { p_operation: 'equipment', p_id: home.id, p_expected_version: home.version, p_data: { idempotencyKey: randomUUID(), equipment: { nickname: 'Histórico', equipmentType: 'split' }, placement: { roomId: home.floors[0].rooms[0].id, wall: 'west', offset: .3, height: 2 } } })
    expect(registration.error).toBeNull()
    const revised = await actor.rpc('write_customer_asset', { p_kind: 'address', p_id: address.id, p_expected_version: address.version, p_data: { ...addressData(), label: 'Dirección corregida' }, p_archive: false })
    expect(revised.error).toBeNull()
    expect(revised.data.replacedId).toBe(address.id)
    const snapshot = await actor.rpc('read_customer_homes')
    const linked = snapshot.data.homes.find((h: CustomerHome) => h.id === home.id) as CustomerHome
    expect(linked.id).toBe(home.id)
    expect(linked.addressId).toBe(revised.data.address.id)
    expect(linked.addressIds).toContain(address.id)
    expect((await actor.rpc('write_customer_asset', { p_kind: 'address', p_id: revised.data.address.id, p_expected_version: revised.data.address.version, p_data: {}, p_archive: true })).error?.code).toBe('P0001')
    expect(snapshot.data.equipment.find((e: { id: string }) => e.id === registration.data.equipment.id).addressId).toBe(address.id)
    const removed = await actor.rpc('write_customer_home', { p_operation: 'save', p_id: linked.id, p_expected_version: linked.version, p_data: { ...saveData(linked), floors: [{ ...linked.floors[0], rooms: [] }], placements: [] } })
    expect(removed.error).toBeNull()
    expect(removed.data.home.placements).toEqual([])
    expect((await actor.from('customer_equipment').select('id,address_id').eq('id', registration.data.equipment.id)).data).toEqual([{ id: registration.data.equipment.id, address_id: address.id }])
    const archived = await actor.rpc('write_customer_home', { p_operation: 'archive', p_id: home.id, p_expected_version: removed.data.home.version, p_data: {} })
    expect(archived.error).toBeNull()
    expect((await actor.from('customer_equipment').select('id').eq('id', registration.data.equipment.id)).data).toHaveLength(1)
    expect((await actor.rpc('write_customer_asset', { p_kind: 'address', p_id: revised.data.address.id, p_expected_version: revised.data.address.version, p_data: {}, p_archive: true })).error).toBeNull()
  })
})
