import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientAppShell } from '@/components/app-shell/client-app-shell'
import { CustomerHogar } from '@/components/customer/hogar/customer-hogar'
import { selectUnitAddress, withLocationProvider } from './location-provider-fixture'
import type { HomeSceneProps } from '@/components/customer/hogar/home-scene'
import type { CustomerAssetAddress, CustomerAssetEquipment } from '@/lib/customer-assets/contracts'
import type { CustomerHome, CustomerHomesSnapshot, HomeFloor } from '@/lib/customer-homes/contracts'

// jsdom has no WebGL. Keep the real parent/forms, replacing only the GPU boundary.
const sceneBoundary = vi.hoisted(() => ({ current: null as HomeSceneProps | null }))
vi.mock('next/dynamic', () => ({ default: () => function SceneBoundary(props: HomeSceneProps) {
  sceneBoundary.current = props
  return <div>
    {props.roomAdditions?.map(slot => <button key={slot.id} onClick={() => props.onAddRoom?.(slot)}>{slot.label}</button>)}
    <button type="button" onClick={() => props.onUnavailable?.()}>Simular dispositivo sin WebGL</button>
    <button type="button" onClick={() => props.onPlace?.({ wall: 'east', offset: .73, height: 1.8 })}>Simular selección de pared</button>
  </div>
} }))
vi.mock('next/navigation', () => ({ usePathname: () => '/app/hogar' }))

const ids = {
  home: '10000000-0000-4000-8000-000000000001', address: '10000000-0000-4000-8000-000000000002',
  floor: '10000000-0000-4000-8000-000000000003', room: '10000000-0000-4000-8000-000000000004',
  air: '10000000-0000-4000-8000-000000000005', upper: '10000000-0000-4000-8000-000000000006',
  bedroom: '10000000-0000-4000-8000-000000000007', otherHome: '10000000-0000-4000-8000-000000000008',
  otherAddress: '10000000-0000-4000-8000-000000000009', otherFloor: '10000000-0000-4000-8000-000000000010',
  officeRoom: '10000000-0000-4000-8000-000000000011', otherAir: '10000000-0000-4000-8000-000000000012',
  newHome: '10000000-0000-4000-8000-000000000013', newAddress: '10000000-0000-4000-8000-000000000014',
  newAir: '10000000-0000-4000-8000-000000000015'
}
const address: CustomerAssetAddress = { id: ids.address, label: 'Casa', street: 'Ejemplo', number: '123', city: 'Buenos Aires', province: 'Buenos Aires', propertyType: 'house', access: {}, isDefault: true, version: 1, createdAt: '2026-10-13', archivedAt: null }
const home: CustomerHome = { id: ids.home, name: 'Mi casa', addressId: ids.address, kind: 'house', building: null, features: { balcony: false, terrace: false, windows: 'large' }, floors: [{ id: ids.floor, name: 'Planta baja', order: 0, rooms: [{ id: ids.room, name: 'Living', kind: 'living', variant: 'compact', x: 0, z: 0, width: 4, depth: 4, rotation: 0, windows: 'large' }] }], placements: [], version: 1 }
const air: CustomerAssetEquipment = { id: ids.air, nickname: 'Aire del living', addressId: ids.address, equipmentType: 'split', brand: 'Marca', model: 'Modelo', serialNumber: null, frigorias: '3000', version: 1, createdAt: '2026-10-13', archivedAt: null }
const upper: HomeFloor = { id: ids.upper, name: 'Planta alta', order: 1, rooms: [{ ...home.floors[0].rooms[0], id: ids.bedroom, name: 'Dormitorio principal', kind: 'bedroom', variant: 'principal' }] }
const snapshot = (): CustomerHomesSnapshot => structuredClone({ homes: [home], addresses: [address], equipment: [air] })
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
type Payload = Record<string, unknown>
type RequestOptions = { method: string; body?: string }
let request: ReturnType<typeof vi.fn>

function submitted(index = 0): Payload { return JSON.parse(request.mock.calls[index][1].body) }
function savedHome(body: Payload): CustomerHome {
  return {
    id: String(body.id ?? ids.newHome), version: Number(body.expectedVersion ?? 0) + 1,
    name: String(body.name), addressId: String(body.addressId), kind: body.kind as CustomerHome['kind'],
    building: body.building as CustomerHome['building'], features: body.features as CustomerHome['features'],
    floors: body.floors as CustomerHome['floors'], placements: body.placements as CustomerHome['placements'],
    addressIds: [String(body.addressId)]
  }
}
function renderHogar(data = snapshot(), shell = false) {
  return render(shell ? <ClientAppShell><CustomerHogar initialData={data} /></ClientAppShell> : <CustomerHogar initialData={data} />)
}
function change(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }) }
function click(name: string) { fireEvent.click(screen.getByRole('button', { name })) }
function beginCreation(data: CustomerHomesSnapshot, kind = 'apartment') {
  renderHogar(data)
  click('Crear mi primer hogar')
  change('Nombre del hogar', 'Nuevo lugar')
  change('Tipo de lugar', kind)
}
function chooseSavedAddress() { change('Dirección', ids.address) }
const populateNewAddress = selectUnitAddress
function placedData(): CustomerHomesSnapshot {
  const data = snapshot()
  data.homes[0].placements.push({ equipmentId: ids.air, roomId: ids.room, wall: 'north', offset: .5, height: 2 })
  return data
}
beforeEach(() => {
  sceneBoundary.current = null
  request = vi.fn(async (path: string, options: RequestOptions) => {
    const body = options.body ? JSON.parse(options.body) : undefined
    if (path === '/api/customer/homes' && (options.method === 'POST' || options.method === 'PUT')) return response({ home: savedHome(body) })
    if (path === '/api/customer/homes' && options.method === 'DELETE') return response({ archived: true })
    throw new Error(`Unexpected API request: ${options.method} ${path}`)
  })
  vi.stubGlobal('fetch', withLocationProvider(request))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); sceneBoundary.current = null })

describe('Hogar complete functional flows', () => {
  it('creates a high-rise apartment with its own visual features and an empty internal floor', async () => {
    beginCreation({ homes: [], addresses: [address], equipment: [] })
    chooseSavedAddress()
    change('Tipo de edificio', 'high')
    fireEvent.click(screen.getByLabelText('Tiene balcón'))
    fireEvent.click(screen.getByLabelText('Tiene terraza'))
    change('Ventanas del hogar', 'mixed')
    change('Distribución inicial', 'empty')
    click('Crear hogar')
    await waitFor(() => expect(screen.getByLabelText('Hogar actual')).toHaveProperty('value', ids.newHome))
    expect(submitted()).toMatchObject({ name: 'Nuevo lugar', addressId: ids.address, kind: 'apartment', building: 'high', features: { balcony: true, terrace: true, windows: 'mixed' }, placements: [] })
    expect(submitted().floors).toEqual([{ id: expect.any(String), name: 'Planta baja', order: 0, rooms: [] }])
    expect(request.mock.calls.map(([path]) => path)).toEqual(['/api/customer/homes'])
    expect(screen.getByText('Esta planta todavía no tiene ambientes.')).toBeTruthy()
  })

  it('creates a PH address without confusing postal floor with internal levels', async () => {
    request.mockImplementation(async (_path: string, options: RequestOptions) => {
      const body = JSON.parse(options.body!)
      return response({ home: savedHome({ ...body, addressId: ids.newAddress }), address: { ...address, ...body.newAddress, id: ids.newAddress } })
    })
    beginCreation({ homes: [], addresses: [], equipment: [] }, 'ph')
    await populateNewAddress()
    change('Piso de la dirección', '8')
    change('Departamento / unidad', 'A')
    click('Crear hogar')
    await waitFor(() => expect(screen.getByLabelText('Hogar actual')).toHaveProperty('value', ids.newHome))
    expect(submitted()).toMatchObject({ addressId: null, kind: 'ph', building: null, newAddress: { propertyType: 'house', floor: '8', apartment: 'A', access: {}, isDefault: false } })
    expect((submitted().floors as HomeFloor[])).toHaveLength(1)
    expect(request.mock.calls.map(([path]) => path)).toEqual(['/api/customer/homes'])
    expect(screen.getByText(/Corrientes 456 · Piso 8 · A/)).toBeTruthy()
  })

  it.each([
    ['house', null, 'bedroom'], ['ph', null, 'bedroom'], ['office', null, 'meeting'],
    ['commercial', null, 'commercial'], ['apartment', 'low', 'bedroom'], ['apartment', 'high', 'bedroom']
  ] as const)('creates the suggested layout for %s / %s using real compatible room definitions', async (kind, building, requiredRoom) => {
    beginCreation({ homes: [], addresses: [address], equipment: [] }, kind)
    chooseSavedAddress()
    if (building) change('Tipo de edificio', building)
    click('Crear hogar')
    await waitFor(() => expect(screen.getByLabelText('Hogar actual')).toHaveProperty('value', ids.newHome))
    expect(submitted()).toMatchObject({ kind, building, addressId: ids.address, placements: [] })
    const rooms = (submitted().floors as HomeFloor[]).flatMap(f => f.rooms)
    expect(rooms.some(room => room.kind === requiredRoom)).toBe(true)
    expect(rooms.every(room => room.id && room.name && room.variant)).toBe(true)
    if (kind === 'office' || kind === 'commercial') expect(rooms.some(room => room.kind === 'bedroom')).toBe(false)
    expect(screen.queryByRole('heading', { name: 'Aire del living' })).toBeNull()
  })

  it.each(['suggested', 'empty'])('retries lost home responses with an identical %s creation payload', async initialLayout => {
    request.mockRejectedValueOnce(new TypeError('Network response lost'))
    beginCreation({ homes: [], addresses: [address], equipment: [] })
    chooseSavedAddress()
    change('Distribución inicial', initialLayout)
    click('Crear hogar')
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    const first = submitted()
    expect(screen.getByLabelText('Nombre del hogar')).toHaveProperty('value', 'Nuevo lugar')
    expect(screen.getByLabelText('Nombre del hogar').matches(':disabled')).toBe(true)
    click('Reintentar creación')
    await waitFor(() => expect(screen.getByLabelText('Hogar actual')).toHaveProperty('value', ids.newHome))
    expect(submitted(1)).toEqual(first)
    expect(within(screen.getByLabelText('Hogar actual')).getAllByRole('option')).toHaveLength(1)
  })

  it('retries atomic creation of a new address and home without a separate duplicating address request', async () => {
    let homeAttempts = 0
    request.mockImplementation(async (_path: string, options: RequestOptions) => {
      const body = JSON.parse(options.body!)
      if (++homeAttempts === 1) throw new TypeError('Lost home response')
      return response({ home: savedHome({ ...body, addressId: ids.newAddress }), address: { ...address, ...body.newAddress, id: ids.newAddress } })
    })
    beginCreation({ homes: [], addresses: [], equipment: [] }, 'house')
    await populateNewAddress(); click('Crear hogar')
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('combobox', { name: 'Dirección' })).toHaveProperty('value', 'Corrientes 456, Buenos Aires, Buenos Aires')
    expect(screen.getByRole('combobox', { name: 'Dirección' }).matches(':disabled')).toBe(true)
    click('Reintentar creación')
    await waitFor(() => expect(screen.getByLabelText('Hogar actual')).toHaveProperty('value', ids.newHome))
    expect(request.mock.calls.map(([path]) => path)).toEqual(['/api/customer/homes', '/api/customer/homes'])
    expect(submitted(1)).toEqual(submitted(0))
    expect(screen.getByText(/Corrientes 456, Buenos Aires/)).toBeTruthy()
  })

  it('keeps incomplete new addresses local and explains the missing fields', () => {
    beginCreation({ homes: [], addresses: [], equipment: [] })
    fireEvent.submit(screen.getByLabelText('Nombre del hogar').closest('form')!)
    expect(screen.getByRole('alert').textContent).toContain('Elegí una sugerencia o ingresá la dirección manualmente')
    expect(request).not.toHaveBeenCalled()
  })

  it('unlocks a definitively rejected home creation so the customer can correct its inputs', async () => {
    request.mockResolvedValueOnce(response({ code: 'invalid_input' }, 400))
    beginCreation({ homes: [], addresses: [address], equipment: [] })
    chooseSavedAddress(); click('Crear hogar')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Revisá los datos ingresados'))
    expect(screen.getByLabelText('Nombre del hogar').matches(':disabled')).toBe(false)
    expect(screen.queryByRole('button', { name: 'Reintentar creación' })).toBeNull()
    change('Nombre del hogar', 'Hogar corregido'); click('Crear hogar')
    await waitFor(() => expect(within(screen.getByLabelText('Hogar actual')).getByRole('option', { name: 'Hogar corregido' })).toBeTruthy())
    expect(submitted(1).name).toBe('Hogar corregido')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('updates home configuration without replacing address, room identities or equipment', async () => {
    renderHogar(placedData())
    click('Configurar hogar')
    change('Nombre del hogar', 'Casa familiar')
    fireEvent.click(screen.getByLabelText('Tiene balcón'))
    change('Ventanas del hogar', 'mixed')
    expect(screen.getByLabelText('Tipo de lugar')).toHaveProperty('disabled', true)
    expect(screen.getByRole('link', { name: 'Corregir datos de la dirección' }).getAttribute('href')).toBe('/app/direcciones')
    click('Guardar configuración')
    await waitFor(() => expect(screen.getByLabelText('Hogar actual')).toHaveProperty('value', ids.home))
    expect(submitted()).toMatchObject({ id: ids.home, addressId: ids.address, expectedVersion: 1, name: 'Casa familiar', features: { balcony: true, windows: 'mixed' }, floors: home.floors, placements: placedData().homes[0].placements })
    expect(screen.getByRole('link', { name: 'Historial de Aire del living' }).getAttribute('href')).toBe(`/app/equipos/${ids.air}`)
  })

  it.each(['balcony', 'terrace'] as const)('requires removing the actual %s room before disabling that home feature', async kind => {
    const data = snapshot()
    data.homes[0].features[kind] = true
    data.homes[0].floors[0].rooms.push({ ...home.floors[0].rooms[0], id: ids.bedroom, name: kind === 'balcony' ? 'Balcón' : 'Terraza', kind, variant: kind === 'balcony' ? 'narrow' : 'open', x: 4.2, windows: 'none' })
    renderHogar(data); click('Configurar hogar')
    const toggle = screen.getByLabelText(kind === 'balcony' ? 'Tiene balcón' : 'Tiene terraza')
    expect(toggle.matches(':disabled')).toBe(true)
    expect(toggle).toHaveProperty('checked', true)
    change('Nombre del hogar', 'Casa con exterior'); click('Guardar configuración')
    await waitFor(() => expect(within(screen.getByLabelText('Hogar actual')).getByRole('option', { name: 'Casa con exterior' })).toBeTruthy())
    expect((submitted().features as Payload)[kind]).toBe(true)
    expect((submitted().floors as HomeFloor[])[0].rooms.some(room => room.kind === kind)).toBe(true)
    click(kind === 'balcony' ? 'Quitar Balcón' : 'Quitar Terraza'); click('Confirmar')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    click('Configurar hogar')
    const availableToggle = screen.getByLabelText(kind === 'balcony' ? 'Tiene balcón' : 'Tiene terraza')
    expect(availableToggle.matches(':disabled')).toBe(false)
    fireEvent.click(availableToggle); click('Guardar configuración')
    await waitFor(() => expect(screen.getByLabelText('Hogar actual')).toBeTruthy())
    expect((submitted(2).features as Payload)[kind]).toBe(false)
    expect((submitted(2).floors as HomeFloor[])[0].rooms.some(room => room.kind === kind)).toBe(false)
  })

  it('adds an empty floor then selects it without rendering rooms from the old floor', async () => {
    renderHogar()
    click('Plantas'); change('Nombre de la planta', 'Segundo nivel'); click('Guardar planta')
    await waitFor(() => expect(within(screen.getByLabelText('Planta actual')).getByRole('option', { name: 'Segundo nivel' })).toBeTruthy())
    const added = (submitted().floors as HomeFloor[])[1]
    expect(added).toMatchObject({ name: 'Segundo nivel', order: 1, rooms: [] })
    expect(screen.getByLabelText('Planta actual')).toHaveProperty('value', added.id)
    expect(screen.queryByRole('button', { name: 'Abrir Living' })).toBeNull()
    expect(sceneBoundary.current?.floorId).toBe(added.id)
  })

  it('adds suggested office rooms rather than residential rooms to a new office floor', async () => {
    const data = snapshot(); data.homes[0].kind = 'office'; data.homes[0].floors[0].rooms = []
    renderHogar(data)
    click('Plantas'); fireEvent.click(screen.getByLabelText('Empezar con ambientes sugeridos')); click('Guardar planta')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir Sala de reuniones' })).toBeTruthy())
    const kinds = (submitted().floors as HomeFloor[])[1].rooms.map(r => r.kind)
    expect(kinds).toEqual(['office', 'meeting', 'reception', 'bathroom'])
    expect(screen.queryByRole('button', { name: 'Abrir Dormitorio' })).toBeNull()
  })

  it('renames and reorders a floor while retaining the rooms and placements', async () => {
    const data = placedData(); data.homes[0].floors.push(structuredClone(upper))
    renderHogar(data)
    change('Planta actual', ids.upper); click('Editar planta actual')
    change('Nombre de la planta', 'Dormitorios'); click('Subir'); click('Guardar planta')
    await waitFor(() => expect(within(screen.getByLabelText('Planta actual')).getByRole('option', { name: 'Dormitorios' })).toBeTruthy())
    const nextFloors = submitted().floors as HomeFloor[]
    expect(nextFloors.map(f => [f.id, f.order])).toEqual([[ids.upper, 0], [ids.floor, 1]])
    expect(nextFloors[0].rooms).toEqual(upper.rooms)
    expect(submitted().placements).toEqual(data.homes[0].placements)
    expect(screen.getByLabelText('Planta actual')).toHaveProperty('value', ids.upper)
    expect(screen.getByRole('button', { name: 'Abrir Dormitorio principal' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Abrir Living' })).toBeNull()
  })

  it('removes a floor after confirmation while conserving its equipment and history', async () => {
    const data = placedData(); data.homes[0].floors.push(structuredClone(upper))
    renderHogar(data)
    click('Editar planta actual'); click('Quitar planta')
    const dialog = screen.getByRole('dialog', { name: '¿Quitar esta planta?' })
    expect(dialog.textContent).toContain('Los equipos y su historial se conservarán')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect((submitted().floors as HomeFloor[]).map(f => f.id)).toEqual([ids.upper])
    expect(submitted().placements).toEqual([])
    expect(screen.getByLabelText('Planta actual')).toHaveProperty('value', ids.upper)
    expect(screen.getByText('Sin ubicar')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Historial de Aire del living' }).getAttribute('href')).toBe(`/app/equipos/${ids.air}`)
    expect(request.mock.calls.every(([path]) => path === '/api/customer/homes')).toBe(true)
  })

  it('never offers removal of the only remaining floor', () => {
    renderHogar(); click('Editar planta actual')
    expect(screen.queryByRole('button', { name: 'Quitar planta' })).toBeNull()
    click('Cancelar')
    expect(screen.getByLabelText('Planta actual')).toHaveProperty('value', ids.floor)
    expect(request).not.toHaveBeenCalled()
  })

  it('creates and previews a selected room variant in the selected side', async () => {
    renderHogar()
    click('Ambientes'); click('Añadir ambiente a la derecha de Living')
    change('Tipo de ambiente', 'bedroom'); click('Variante siguiente')
    expect(sceneBoundary.current?.focused).toBe(true)
    const draftId = sceneBoundary.current?.roomId
    expect(sceneBoundary.current?.home.floors[0].rooms.find(r => r.id === draftId)).toMatchObject({ name: 'Dormitorio', kind: 'bedroom', variant: 'double', rotation: 0 })
    click('Añadir ambiente')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir Dormitorio' })).toBeTruthy())
    const added = (submitted().floors as HomeFloor[])[0].rooms.find(r => r.id === draftId)
    expect(added).toMatchObject({ name: 'Dormitorio', kind: 'bedroom', variant: 'double', rotation: 0, x: 4.15, z: 0 })
    expect((submitted().floors as HomeFloor[])[0].rooms[0]).toEqual(home.floors[0].rooms[0])
  })

  it('rejects overlapping room layouts before a network mutation and preserves the cancel path', async () => {
    const data = snapshot(); data.homes[0].floors[0].rooms.push({ ...upper.rooms[0], x: 4.2 })
    renderHogar(data)
    click('Editar Dormitorio principal'); change('Posición horizontal', '0'); click('Guardar ambiente')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Los ambientes no pueden superponerse'))
    expect(screen.getByLabelText('Posición horizontal')).toHaveProperty('value', '0')
    expect(request).not.toHaveBeenCalled()
    click('Cancelar')
    expect(screen.getByRole('button', { name: 'Abrir Dormitorio principal' })).toBeTruthy()
    expect(sceneBoundary.current?.home.floors[0].rooms[1].x).toBe(4.2)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('removes a room but leaves its air unplaced rather than deleting the registered asset', async () => {
    renderHogar(placedData())
    click('Quitar Living'); click('Confirmar')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Abrir Living' })).toBeNull())
    expect((submitted().floors as HomeFloor[])[0].rooms).toEqual([])
    expect(submitted().placements).toEqual([])
    expect(screen.getByRole('heading', { name: 'Aire del living' })).toBeTruthy()
    expect(screen.getByText('Sin ubicar')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Historial de Aire del living' }).getAttribute('href')).toBe(`/app/equipos/${ids.air}`)
    expect(screen.getByRole('button', { name: 'Ubicar Aire del living' })).toHaveProperty('disabled', true)
  })

  it('isolates the selected room and atomically registers its air with the chosen wall position', async () => {
    request.mockImplementation(async (_path: string, options: RequestOptions) => {
      const body = JSON.parse(options.body!)
      return response({ home: { ...home, version: 2, placements: [{ equipmentId: ids.newAir, ...body.placement }] }, equipment: { ...air, ...body.equipment, id: ids.newAir, frigorias: '4500' } })
    })
    renderHogar(); click('Abrir Living'); click('Equipos')
    change('Nombre del aire', 'Aire nuevo'); change('Tipo de aire', 'inverter'); change('Marca (opcional)', 'Real'); change('Frigorías (opcional)', '4500')
    click('Simular selección de pared')
    expect(sceneBoundary.current?.placementDraft).toMatchObject({ wall: 'east', offset: .73, height: 1.8 })
    for (const label of ['Ambiente', 'Pared', 'Posición sobre la pared', 'Altura orientativa']) expect(screen.queryByLabelText(label, { exact: true })).toBeNull()
    expect(sceneBoundary.current).toMatchObject({ floorId: ids.floor, roomId: ids.room, focused: true })
    click('Registrar y ubicar aire')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Aire nuevo' })).toBeTruthy())
    expect(request.mock.calls[0][0]).toBe('/api/customer/homes/equipment')
    expect(submitted()).toMatchObject({ homeId: ids.home, expectedVersion: 1, idempotencyKey: expect.any(String), equipment: { nickname: 'Aire nuevo', equipmentType: 'inverter', brand: 'Real', frigorias: 4500 }, placement: { roomId: ids.room, wall: 'east', offset: .73, height: 1.8 } })
    expect((submitted().placement as Payload).equipmentId).toBeUndefined()
    expect(screen.getByRole('link', { name: 'Historial de Aire nuevo' }).getAttribute('href')).toBe(`/app/equipos/${ids.newAir}`)
    expect(screen.getByRole('button', { name: 'Reubicar Aire nuevo' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Aires del hogar' }).textContent).toContain('Living')
  })

  it('retries registration using the same idempotency key and never invents a second inventory entry', async () => {
    request.mockRejectedValueOnce(new TypeError('Equipment response lost')).mockImplementationOnce(async (_path: string, options: RequestOptions) => {
      const body = JSON.parse(options.body!)
      return response({ home: { ...home, version: 2, placements: [{ equipmentId: ids.newAir, ...body.placement }] }, equipment: { ...air, ...body.equipment, id: ids.newAir, frigorias: null } })
    })
    renderHogar(); click('Equipos'); change('Nombre del aire', 'Aire nuevo'); click('Registrar y ubicar aire')
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    const first = submitted()
    click('Registrar y ubicar aire')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Aire nuevo' })).toBeTruthy())
    expect(submitted(1)).toEqual(first)
    expect(screen.getAllByRole('heading', { name: 'Aire nuevo' })).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Historial de Aire nuevo' }).getAttribute('href')).toBe(`/app/equipos/${ids.newAir}`)
  })

  it('locks an uncertain equipment registration so retry cannot drift from its original payload', async () => {
    request.mockRejectedValueOnce(new TypeError('Equipment response lost')).mockImplementationOnce(async (_path: string, options: RequestOptions) => {
      const body = JSON.parse(options.body!)
      return response({ home: { ...home, version: 2, placements: [{ equipmentId: ids.newAir, ...body.placement }] }, equipment: { ...air, ...body.equipment, id: ids.newAir, frigorias: null } })
    })
    const data = snapshot(); data.homes[0].floors.push(upper)
    renderHogar(data); click('Equipos'); change('Nombre del aire', 'Aire nuevo'); click('Registrar y ubicar aire')
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    const first = submitted()
    expect(screen.getByLabelText('Nombre del aire').matches(':disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Ambiente siguiente' })).toHaveProperty('disabled', true)
    click('Ambiente siguiente')
    // A queued GPU gesture must not change a frozen command while its result is unknown.
    act(() => sceneBoundary.current?.onPlace?.({ wall: 'west', offset: .9, height: .5 }))
    expect(sceneBoundary.current?.placementDraft).toMatchObject({ roomId: ids.room, wall: 'north' })
    fireEvent.click(screen.getByRole('button', { name: /^(Registrar y ubicar aire|Reintentar registro|Reintentar alta)$/ }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Aire nuevo' })).toBeTruthy())
    expect(submitted(1)).toEqual(first)
  })

  it('places an existing air without changing its equipment identity or postal address', async () => {
    renderHogar(); click('Ubicar Aire del living'); click('Simular selección de pared'); click('Guardar ubicación')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reubicar Aire del living' })).toBeTruthy())
    expect(request.mock.calls[0][0]).toBe('/api/customer/homes')
    expect(request.mock.calls[0][1].method).toBe('PUT')
    expect(submitted().placements).toEqual([{ equipmentId: ids.air, roomId: ids.room, wall: 'east', offset: .73, height: 1.8 }])
    expect(submitted().addressId).toBe(ids.address)
    expect(sceneBoundary.current?.equipment.find(e => e.id === ids.air)?.addressId).toBe(ids.address)
    expect(screen.getByRole('link', { name: 'Historial de Aire del living' }).getAttribute('href')).toBe(`/app/equipos/${ids.air}`)
  })

  it.each([null, 'unsupported_legacy_type'])('explains an incomplete legacy air type (%s) instead of silently treating it as Split', type => {
    const data = snapshot(); data.equipment[0].equipmentType = type
    renderHogar(data)
    expect(screen.getByRole('button', { name: 'Ubicar Aire del living' })).toHaveProperty('disabled', true)
    expect(screen.getByText(/tipo.*ficha|ficha.*tipo/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Historial de Aire del living' }).getAttribute('href')).toBe(`/app/equipos/${ids.air}`)
    expect(sceneBoundary.current?.equipment.some(item => item.id === ids.air)).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Ubicar Aire del living' }))
    expect(screen.queryByLabelText('Pared')).toBeNull()
    expect(request).not.toHaveBeenCalled()
  })

  it('removes only an equipment location after confirmation and retains its history link', async () => {
    renderHogar(placedData()); click('Quitar ubicación de Aire del living')
    click('Cancelar')
    expect(request).not.toHaveBeenCalled()
    click('Quitar ubicación de Aire del living'); click('Confirmar')
    await waitFor(() => expect(screen.getByText('Sin ubicar')).toBeTruthy())
    expect(submitted().placements).toEqual([])
    expect(screen.getByRole('button', { name: 'Ubicar Aire del living' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Historial de Aire del living' }).getAttribute('href')).toBe(`/app/equipos/${ids.air}`)
  })

  it('switches homes and floors without leaking rooms or inventory from another address', () => {
    const data = snapshot(); data.homes[0].floors.push(structuredClone(upper))
    data.addresses.push({ ...address, id: ids.otherAddress, label: 'Oficina', street: 'Lavalle', propertyType: 'office' })
    data.equipment.push({ ...air, id: ids.otherAir, nickname: 'Aire oficina', addressId: ids.otherAddress })
    data.homes.push({ ...home, id: ids.otherHome, name: 'Mi oficina', addressId: ids.otherAddress, kind: 'office', floors: [{ id: ids.otherFloor, name: 'Oficina PB', order: 0, rooms: [{ ...home.floors[0].rooms[0], id: ids.officeRoom, name: 'Trabajo', kind: 'office', variant: 'shared' }] }] })
    renderHogar(data)
    change('Planta actual', ids.upper)
    expect(screen.queryByRole('button', { name: 'Abrir Living' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Abrir Dormitorio principal' })).toBeTruthy()
    expect(sceneBoundary.current?.floorId).toBe(ids.upper)
    change('Hogar actual', ids.otherHome)
    expect(screen.getByLabelText('Planta actual')).toHaveProperty('value', ids.otherFloor)
    expect(sceneBoundary.current).toMatchObject({ home: { id: ids.otherHome }, floorId: ids.otherFloor, roomId: null })
    expect(screen.getByRole('button', { name: 'Abrir Trabajo' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Aire oficina' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Aire del living' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Abrir Dormitorio principal' })).toBeNull()
    expect(request).not.toHaveBeenCalled()
  })

  it('archives only the selected home and switches to the surviving home', async () => {
    const data = snapshot()
    data.addresses.push({ ...address, id: ids.otherAddress })
    data.homes.push({ ...home, id: ids.otherHome, name: 'Otro hogar', addressId: ids.otherAddress, floors: [{ id: ids.otherFloor, name: 'Nivel único', order: 0, rooms: [] }] })
    renderHogar(data); click('Archivar hogar')
    expect(screen.getByRole('dialog').textContent).toContain('sus equipos, direcciones y servicios anteriores se conservarán')
    click('Confirmar')
    await waitFor(() => expect(screen.getByLabelText('Hogar actual')).toHaveProperty('value', ids.otherHome))
    expect(request.mock.calls[0][1].method).toBe('DELETE')
    expect(submitted()).toEqual({ id: ids.home, expectedVersion: 1 })
    expect(screen.getByLabelText('Planta actual')).toHaveProperty('value', ids.otherFloor)
    expect(within(screen.getByLabelText('Hogar actual')).queryByRole('option', { name: 'Mi casa' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Gestionar direcciones' })).toBeTruthy()
  })

  it('keeps visual wall placement usable without a GPU or location form', async () => {
    renderHogar(); click('Simular dispositivo sin WebGL')
    expect(screen.getByText(/La vista 3D no está disponible en este dispositivo/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Volver a 3D' })).toBeNull()
    click('Editar Living'); change('Nombre del ambiente', 'Estar accesible'); click('Guardar ambiente')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir Estar accesible' })).toBeTruthy())
    click('Ubicar Aire del living'); click('Pared izquierda')
    fireEvent.keyDown(screen.getByRole('button', { name: 'Pared izquierda' }), { key: 'ArrowRight' })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Pared izquierda' }), { key: 'ArrowDown' })
    click('Guardar ubicación')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reubicar Aire del living' })).toBeTruthy())
    expect(submitted(1)).toMatchObject({ expectedVersion: 2, placements: [{ equipmentId: ids.air, wall: 'west', offset: .55, height: 1.9 }] })
  })

  it('places the equipment action before rooms and keeps only equipment data below the scene', () => {
    renderHogar()
    const buttons = screen.getAllByRole('button')
    const equipmentButton = screen.getByRole('button', { name: 'Equipos' })
    expect(buttons.indexOf(equipmentButton)).toBeLessThan(buttons.indexOf(screen.getByRole('button', { name: 'Ambientes' })))
    click('Equipos')
    expect(screen.getByRole('heading', { name: 'Datos del aire' })).toBeTruthy()
    expect(screen.queryByText('Ubicación en el ambiente')).toBeNull()
    for (const label of ['Ambiente', 'Pared', 'Posición sobre la pared', 'Altura orientativa']) expect(screen.queryByLabelText(label, { exact: true })).toBeNull()
    expect(screen.getByRole('button', { name: 'Ambiente anterior' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Ambiente siguiente' })).toHaveProperty('disabled', true)
    click('Cancelar')
    expect(request).not.toHaveBeenCalled()
  })

  it('cycles through the home rooms across floors without losing equipment data', async () => {
    const data = snapshot()
    data.homes[0].floors.push({ ...upper, order: 2 }, { id: ids.otherFloor, name: 'Planta vacía', order: 1, rooms: [] })
    request.mockImplementation(async (_path: string, options: RequestOptions) => {
      const body = JSON.parse(options.body!)
      return response({ home: { ...data.homes[0], version: 2, placements: [{ equipmentId: ids.newAir, ...body.placement }] }, equipment: { ...air, ...body.equipment, id: ids.newAir } })
    })
    renderHogar(data); click('Equipos')
    change('Nombre del aire', 'Aire de arriba'); change('Marca (opcional)', 'Marca elegida')
    click('Ambiente siguiente')
    expect(sceneBoundary.current).toMatchObject({ floorId: ids.upper, roomId: ids.bedroom, focused: true })
    expect(screen.getByRole('status', { name: 'Ambiente seleccionado' }).textContent).toContain('Dormitorio principal')
    click('Ambiente siguiente')
    expect(sceneBoundary.current?.roomId).toBe(ids.room)
    click('Ambiente anterior')
    expect(sceneBoundary.current?.roomId).toBe(ids.bedroom)
    expect(screen.getByLabelText('Nombre del aire')).toHaveProperty('value', 'Aire de arriba')
    expect(screen.getByLabelText('Marca (opcional)')).toHaveProperty('value', 'Marca elegida')
    expect(request).not.toHaveBeenCalled()
    click('Simular selección de pared'); click('Registrar y ubicar aire')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Aire de arriba' })).toBeTruthy())
    expect(submitted()).toMatchObject({ equipment: { nickname: 'Aire de arriba', brand: 'Marca elegida' }, placement: { roomId: ids.bedroom, wall: 'east', offset: .73, height: 1.8 } })
    expect(screen.getByLabelText('Planta actual')).toHaveProperty('value', ids.upper)
  })

  it('starts from an available room on another floor and preserves existing equipment locations', () => {
    const data = snapshot()
    data.homes[0].floors[0].rooms = []
    data.homes[0].floors.push(upper)
    data.homes[0].placements.push({ equipmentId: ids.air, roomId: ids.bedroom, wall: 'west', offset: .7, height: 1.7 })
    renderHogar(data)
    click('Equipos')
    expect(sceneBoundary.current).toMatchObject({ floorId: ids.upper, roomId: ids.bedroom })
    click('Cancelar'); change('Planta actual', ids.floor)
    click('Reubicar Aire del living')
    expect(sceneBoundary.current).toMatchObject({ floorId: ids.upper, roomId: ids.bedroom, placementDraft: { wall: 'west', offset: .7, height: 1.7 } })
    click('Cancelar')
    expect(request).not.toHaveBeenCalled()
  })

  it('hides the real shell navigation only while editing or confirming and restores it on exit', async () => {
    renderHogar(snapshot(), true)
    expect(screen.getByRole('navigation', { name: 'Navegación principal del cliente' })).toBeTruthy()
    click('Editar Living')
    expect(screen.queryByRole('navigation', { name: 'Navegación principal del cliente' })).toBeNull()
    expect(new Event('beforeunload', { cancelable: true }).defaultPrevented).toBe(false)
    const blockedUnload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(blockedUnload)
    expect(blockedUnload.defaultPrevented).toBe(true)
    click('Cancelar')
    expect(screen.getByRole('navigation', { name: 'Navegación principal del cliente' })).toBeTruthy()
    const freeUnload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(freeUnload)
    expect(freeUnload.defaultPrevented).toBe(false)
    click('Quitar Living')
    expect(screen.queryByRole('navigation', { name: 'Navegación principal del cliente' })).toBeNull()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.getByRole('navigation', { name: 'Navegación principal del cliente' })).toBeTruthy()
    click('Ubicar Aire del living')
    expect(screen.queryByRole('navigation', { name: 'Navegación principal del cliente' })).toBeNull()
    click('Guardar ubicación')
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Navegación principal del cliente' })).toBeTruthy())
  })

  it('blocks duplicate saves while pending and preserves the draft for a recoverable error', async () => {
    let resolvePending!: (value: Response) => void
    request.mockImplementationOnce(() => new Promise<Response>(resolve => { resolvePending = resolve }))
    renderHogar(); click('Editar Living'); change('Nombre del ambiente', 'Estar pendiente')
    const form = screen.getByLabelText('Nombre del ambiente').closest('form')!
    click('Guardar ambiente')
    expect(screen.getByRole('button', { name: 'Guardando…' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveProperty('disabled', true)
    fireEvent.submit(form)
    expect(request).toHaveBeenCalledTimes(1)
    await act(async () => resolvePending(response({ code: 'internal_error' }, 500)))
    expect(screen.getByRole('alert').textContent).toContain('No pudimos completar la operación')
    expect(screen.getByLabelText('Nombre del ambiente')).toHaveProperty('value', 'Estar pendiente')
    click('Guardar ambiente')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir Estar pendiente' })).toBeTruthy())
    expect(submitted(1)).toEqual(submitted(0))
  })

  it('reloads after a version conflict and shows the authoritative updated snapshot', async () => {
    const refreshed = snapshot(); refreshed.homes[0].version = 4; refreshed.homes[0].floors[0].rooms[0].name = 'Living actualizado'
    request.mockResolvedValueOnce(response({ code: 'conflict' }, 409)).mockResolvedValueOnce(response(refreshed))
    renderHogar(); click('Editar Living'); change('Nombre del ambiente', 'Cambio local'); click('Guardar ambiente')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Los datos cambiaron'))
    expect(screen.getByLabelText('Nombre del ambiente')).toHaveProperty('value', 'Cambio local')
    click('Recargar Hogar')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir Living actualizado' })).toBeTruthy())
    expect(request.mock.calls[1][1].method).toBe('GET')
    expect(request.mock.calls[1][1].body).toBeUndefined()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('Cambio local')).toBeNull()
    click('Editar Living actualizado'); change('Nombre del ambiente', 'Reintentado'); click('Guardar ambiente')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir Reintentado' })).toBeTruthy())
    expect(submitted(2).expectedVersion).toBe(4)
  })
})
