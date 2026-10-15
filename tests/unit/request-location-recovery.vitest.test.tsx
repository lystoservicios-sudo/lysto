import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useCallback, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestLocationStep } from '@/features/service-request/request-location-step'
import { homeSaveInput, readRequestHomeCommand, storeRequestHomeCommand, type RequestHomeCommand } from '@/features/service-request/request-home-client'
import type { RequestLocationSelection } from '@/features/service-request/request-draft'
import type { CustomerHomesSnapshot } from '@/lib/customer-homes/contracts'
import { storePendingHomeOperation } from '@/lib/customer-homes/pending-operation'

const actor = '41000000-0000-4000-8000-000000000001'
const addressId = '41000000-0000-4000-8000-000000000002'
const homeId = '41000000-0000-4000-8000-000000000003'
const floorId = '41000000-0000-4000-8000-000000000004'
const roomId = '41000000-0000-4000-8000-000000000005'
const airId = '41000000-0000-4000-8000-000000000006'
const upstairsId = '41000000-0000-4000-8000-000000000007'
const bedroomId = '41000000-0000-4000-8000-000000000008'
const key = '41000000-0000-4000-8000-000000000009'

function inventory(): CustomerHomesSnapshot {
  return {
    addresses: [{ id: addressId, label: 'Casa', street: 'San Martín', number: '456', city: 'CABA', province: 'Buenos Aires', propertyType: 'house', access: {}, isDefault: true, version: 2, createdAt: '2026-10-14T12:00:00Z', archivedAt: null }],
    equipment: [{ id: airId, nickname: 'Aire del living', addressId, equipmentType: 'inverter', brand: null, model: null, serialNumber: null, frigorias: '3000', version: 2, createdAt: '2026-10-14T12:00:00Z', archivedAt: null }],
    homes: [{ id: homeId, name: 'Casa', addressId, kind: 'house', building: null, features: { balcony: false, terrace: false, windows: 'small' }, version: 2,
      floors: [{ id: floorId, name: 'Planta principal', order: 0, rooms: [{ id: roomId, name: 'Living', kind: 'living', variant: 'family', x: 0, z: 0, width: 4, depth: 4, rotation: 0, windows: 'small' }] },
        { id: upstairsId, name: 'Planta superior', order: 1, rooms: [{ id: bedroomId, name: 'Dormitorio', kind: 'bedroom', variant: 'principal', x: 0, z: 0, width: 4, depth: 4, rotation: 0, windows: 'small' }] }],
      placements: [{ equipmentId: airId, roomId, wall: 'north', offset: .5, height: 2 }] }]
  }
}
function homeCommand(): Extract<RequestHomeCommand, { kind: 'save-home' }> { return { kind: 'save-home', input: homeSaveInput({ ...inventory().homes[0], name: 'Nombre del guardado incierto' }) } }
function addressCommand(): Extract<RequestHomeCommand, { kind: 'save-address' }> {
  const { createdAt, archivedAt, version, ...input } = inventory().addresses[0]
  void createdAt; void archivedAt
  return { kind: 'save-address', input: { ...input, street: 'Calle del guardado incierto', expectedVersion: version } }
}
function newHomeCommand(): Extract<RequestHomeCommand, { kind: 'create-home' }> {
  const { id, expectedVersion, ...input } = homeSaveInput(inventory().homes[0])
  void id; void expectedVersion
  return { kind: 'create-home', input: { ...input, placements: [], idempotencyKey: key } }
}
function currentInventory(): CustomerHomesSnapshot {
  const actual = inventory()
  actual.addresses[0] = { ...actual.addresses[0], street: 'Dirección actual', version: 4 }
  actual.homes[0] = { ...actual.homes[0], name: 'Casa actual', version: 4, placements: [{ equipmentId: airId, roomId: bedroomId, wall: 'east', offset: .3, height: 1.8 }] }
  return actual
}
function mount(command?: RequestHomeCommand) {
  if (command) storeRequestHomeCommand(actor, command)
  const selected = vi.fn(), changed = vi.fn()
  function Harness() {
    const [data, setData] = useState(inventory)
    const [locked, setLocked] = useState(false)
    const [selection, setSelection] = useState<RequestLocationSelection | null>(null)
    const onData = useCallback((value: CustomerHomesSnapshot) => { changed(value); setData(value) }, [])
    const onSelect = useCallback((value: RequestLocationSelection | null) => { selected(value); setSelection(value) }, [])
    return <>
      <RequestLocationStep customerId={actor} data={data} equipmentId={airId} selection={selection}
        onData={onData} onEquipmentCreated={vi.fn()}
        onSelect={onSelect} onLock={setLocked} />
      <button disabled={locked}>Continuar prueba</button>
    </>
  }
  const view = render(<Harness />)
  return { selected, changed, unmount: view.unmount }
}
function deferredRead(snapshot = currentInventory(), status = 200) {
  let finish: (response: Response) => void = () => {}
  let first = true
  const fetcher = vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
    void input; void options
    if (!first) return Promise.resolve(new Response(JSON.stringify(snapshot), { status }))
    first = false
    return new Promise<Response>(resolve => { finish = resolve })
  })
  vi.stubGlobal('fetch', fetcher)
  return { fetcher, finish: async () => { await act(async () => finish(new Response(JSON.stringify(snapshot), { status }))) } }
}
function review() { fireEvent.click(screen.getByRole('button', { name: 'Revisar ubicación actual' })) }
function continueButton() { return screen.getByRole('button', { name: 'Continuar prueba' }) as HTMLButtonElement }
beforeEach(() => window.sessionStorage.clear())
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('explicit recovery of a superseded location PUT', () => {
  it('reads authenticated canonical placement before clearing the uncertain home save and unlocking', async () => {
    let finish: (response: Response) => void = () => {}
    const fetcher = vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
      void input; void options
      return new Promise<Response>(resolve => { finish = resolve })
    })
    vi.stubGlobal('fetch', fetcher)
    const command = homeCommand(), { selected, changed } = mount(command)
    expect(continueButton().disabled).toBe(true)
    review()
    expect(readRequestHomeCommand(actor).command).toEqual(command)
    expect(continueButton().disabled).toBe(true)
    expect(changed).not.toHaveBeenCalled()
    await act(async () => finish(new Response(JSON.stringify(currentInventory()), { status: 200 })))
    await waitFor(() => expect(readRequestHomeCommand(actor).command).toBeNull())
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toBe('/api/customer/homes')
    const options = fetcher.mock.calls[0][1] as RequestInit
    expect(options.method).toBe('GET')
    expect(options.headers).toMatchObject({ 'X-Lysto-Customer-Id': actor })
    expect(changed).toHaveBeenLastCalledWith(currentInventory())
    expect(selected).toHaveBeenLastCalledWith({ homeId, addressId, floorId: upstairsId, roomId: bedroomId, homeVersion: 4 })
    expect((screen.getByLabelText('Planta') as HTMLSelectElement).value).toBe(upstairsId)
    expect(screen.getByRole('radio', { name: 'Dormitorio' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByRole('radio', { name: 'Living' })).toBeNull()
    expect(screen.getByText('Dirección actual 456, CABA')).toBeTruthy()
    expect(screen.getByText(/Revisá la ubicación actual antes de continuar/)).toBeTruthy()
    await waitFor(() => expect(continueButton().disabled).toBe(false))
  })
  it('can explicitly release an uncertain address PUT after its canonical version advanced', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(currentInventory()), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    const { changed } = mount(addressCommand())
    review()
    await waitFor(() => expect(readRequestHomeCommand(actor).command).toBeNull())
    expect(changed).toHaveBeenCalledWith(currentInventory())
    expect(screen.getByText('Dirección actual 456, CABA')).toBeTruthy()
    expect(screen.getByText(/No damos por confirmado el guardado anterior/)).toBeTruthy()
    await waitFor(() => expect(continueButton().disabled).toBe(false))
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it.each([{ kind: 'home', version: 1 }, { kind: 'home', version: 2 }, { kind: 'address', version: 1 }, { kind: 'address', version: 2 }])('keeps the uncertain $kind PUT when target version $version is not newer than its precondition', async ({ kind, version }) => {
    const actual = inventory()
    if (kind === 'home') actual.homes[0].version = version; else actual.addresses[0].version = version
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(actual), { status: 200 })))
    const command = kind === 'home' ? homeCommand() : addressCommand(), { changed } = mount(command)
    review()
    await screen.findByRole('alert')
    expect(readRequestHomeCommand(actor).command).toEqual(command)
    expect(changed).not.toHaveBeenCalled()
    expect(continueButton().disabled).toBe(true)
  })
  it.each(['home', 'address'] as const)('retains the lock if the canonical %s target is missing', async kind => {
    const actual = currentInventory()
    if (kind === 'home') actual.homes = []; else actual.addresses = []
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(actual), { status: 200 })))
    const command = kind === 'home' ? homeCommand() : addressCommand(), { changed } = mount(command)
    review()
    await screen.findByRole('alert')
    expect(readRequestHomeCommand(actor).command).toEqual(command)
    expect(changed).not.toHaveBeenCalled()
    expect(continueButton().disabled).toBe(true)
  })
  it('retains the exact command on a failed authenticated canonical read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })))
    const command = homeCommand(), { changed } = mount(command)
    review()
    await screen.findByRole('alert')
    expect(readRequestHomeCommand(actor).command).toEqual(command)
    expect(changed).not.toHaveBeenCalled()
    expect(continueButton().disabled).toBe(true)
  })
  it('never acknowledges or clears a delayed canonical read after the location screen unmounts', async () => {
    const read = deferredRead(), command = homeCommand(), { selected, changed, unmount } = mount(command)
    selected.mockClear()
    review(); unmount()
    await read.finish()
    expect(readRequestHomeCommand(actor).command).toEqual(command)
    expect(changed).not.toHaveBeenCalled()
    expect(selected).not.toHaveBeenCalled()
  })
  it('retains a different persisted command that appears while the canonical read is in flight', async () => {
    const read = deferredRead()
    mount(homeCommand()); review()
    const replacement = addressCommand()
    storeRequestHomeCommand(actor, replacement)
    await read.finish()
    expect(screen.getByRole('alert').textContent).toContain('El guardado pendiente cambió')
    expect(readRequestHomeCommand(actor).command).toEqual(replacement)
    expect(continueButton().disabled).toBe(true)
  })
  it.each(['new-post', 'corrupt'] as const)('never lets a later old PUT retry delete %s storage after recovery detected its replacement', async replacement => {
    const command = homeCommand(), actual = inventory()
    actual.homes[0] = { ...actual.homes[0], name: command.input.name, version: 3 }
    const read = deferredRead(actual)
    mount(command); review()
    if (replacement === 'new-post') storeRequestHomeCommand(actor, newHomeCommand())
    else window.sessionStorage.setItem(`lysto:pedir:location:${actor}`, '{}')
    const retained = window.sessionStorage.getItem(`lysto:pedir:location:${actor}`)
    await read.finish()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reintentar el guardado pendiente' })))
    expect(window.sessionStorage.getItem(`lysto:pedir:location:${actor}`)).toBe(retained)
    expect(continueButton().disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Reintentar el guardado pendiente' }) as HTMLButtonElement).disabled).toBe(true)
    expect(read.fetcher).toHaveBeenCalledTimes(1)
  })
  it('does not let a successful old PUT replay clear a newer POST command stored during its reads', async () => {
    const command = homeCommand(), actual = inventory()
    actual.homes[0] = { ...actual.homes[0], name: command.input.name, version: 3 }
    const read = deferredRead(actual)
    mount(command)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar el guardado pendiente' }))
    const replacement = newHomeCommand()
    storeRequestHomeCommand(actor, replacement)
    await read.finish()
    expect(readRequestHomeCommand(actor).command).toEqual(replacement)
    expect(continueButton().disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Reintentar el guardado pendiente' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('does not let a definite 4xx from a fresh PUT clear a different pending POST identity', async () => {
    const read = deferredRead(inventory(), 400)
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByLabelText('Calle'), { target: { value: 'Calle nueva' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar dirección' }))
    const replacement = newHomeCommand()
    storeRequestHomeCommand(actor, replacement)
    await read.finish()
    expect(readRequestHomeCommand(actor).command).toEqual(replacement)
    expect(continueButton().disabled).toBe(true)
  })
  it('matches a freshly submitted uncertain PUT by canonical field order without dropping its real values', async () => {
    const actual = inventory()
    actual.addresses[0] = { ...actual.addresses[0], street: 'Dirección declarada nueva', version: 3 }
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('Lost response')).mockImplementation(async () => new Response(JSON.stringify(actual), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByLabelText('Calle'), { target: { value: 'Dirección declarada nueva' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar dirección' }))
    await screen.findByRole('alert')
    await act(async () => review())
    await waitFor(() => expect(readRequestHomeCommand(actor).command).toBeNull())
    expect(screen.getByText('Dirección declarada nueva 456, CABA')).toBeTruthy()
    await waitFor(() => expect(continueButton().disabled).toBe(false))
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('retains the PUT if another uncertain Hogar operation appears during the canonical read', async () => {
    const read = deferredRead(), command = homeCommand(), { changed } = mount(command)
    review()
    storePendingHomeOperation(actor, newHomeCommand())
    await read.finish()
    expect(screen.getByRole('alert').textContent).toContain('Tenés un guardado pendiente en Hogar')
    expect(readRequestHomeCommand(actor).command).toEqual(command)
    expect(changed).not.toHaveBeenCalled()
    expect(continueButton().disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Revisar ubicación actual' })).toBeNull()
  })
  it('keeps the exact pending command and lock if this tab cannot remove its persisted recovery identity', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(currentInventory()), { status: 200 })))
    const command = homeCommand()
    mount(command)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('storage unavailable') })
    review()
    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos resolver el guardado pendiente')
    expect(readRequestHomeCommand(actor).command).toEqual(command)
    expect(continueButton().disabled).toBe(true)
  })
  it.each(['create-home', 'add-equipment'] as const)('never offers to discard an uncertain %s POST', kind => {
    const command: RequestHomeCommand = kind === 'create-home' ? newHomeCommand() : { kind: 'add-equipment', input: { homeId, expectedVersion: 2, idempotencyKey: key, equipment: { nickname: 'Aire nuevo', equipmentType: 'split' }, placement: { roomId, wall: 'north', offset: .5, height: 2 } } }
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    mount(command)
    expect(screen.queryByRole('button', { name: 'Revisar ubicación actual' })).toBeNull()
    expect(readRequestHomeCommand(actor).command).toEqual(command)
    expect(continueButton().disabled).toBe(true)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('does not offer discard for corrupted pending storage', () => {
    window.sessionStorage.setItem(`lysto:pedir:location:${actor}`, '{}')
    mount()
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Revisar ubicación actual' })).toBeNull()
    expect(continueButton().disabled).toBe(true)
  })
  it('does not offer discard while another uncertain Hogar creation must be resolved', () => {
    storePendingHomeOperation(actor, newHomeCommand())
    mount(homeCommand())
    expect(screen.getByRole('alert').textContent).toContain('Tenés un guardado pendiente en Hogar')
    expect(screen.queryByRole('button', { name: 'Revisar ubicación actual' })).toBeNull()
    expect(continueButton().disabled).toBe(true)
  })
})
