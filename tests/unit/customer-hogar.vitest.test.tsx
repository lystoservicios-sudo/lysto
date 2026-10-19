import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomerHogar } from '@/components/customer/hogar/customer-hogar'
import type { CustomerHome, CustomerHomesSnapshot } from '@/lib/customer-homes/contracts'

// WebGL is not provided by jsdom; the functional controls are intentionally tested without a GPU.
const sceneState = vi.hoisted(() => ({ equipment: undefined as unknown }))
vi.mock('next/dynamic', () => ({ default: () => (props: { equipment: unknown }) => {
  sceneState.equipment = props.equipment
  return <p>Vista 3D no disponible en esta prueba</p>
} }))
vi.mock('next/navigation', () => ({ usePathname: () => '/app/hogar' }))

const ids = {
  home: '10000000-0000-4000-8000-000000000001', address: '10000000-0000-4000-8000-000000000002',
  floor: '10000000-0000-4000-8000-000000000003', room: '10000000-0000-4000-8000-000000000004',
  air: '10000000-0000-4000-8000-000000000005'
}
const address = { id: ids.address, label: 'Casa', street: 'Ejemplo', number: '123', city: 'Buenos Aires', province: 'Buenos Aires', propertyType: 'house' as const, access: {}, isDefault: true, version: 1, createdAt: '2026-10-13', archivedAt: null }
const home: CustomerHome = { id: ids.home, name: 'Mi casa', addressId: ids.address, kind: 'house', building: null, features: { balcony: false, terrace: false, windows: 'large' }, floors: [{ id: ids.floor, name: 'Planta baja', order: 0, rooms: [{ id: ids.room, name: 'Living', kind: 'living', variant: 'compact', x: 0, z: 0, width: 4, depth: 4, rotation: 0, windows: 'large' }] }], placements: [], version: 1 }
const equipment = { id: ids.air, nickname: 'Aire del living', addressId: ids.address, equipmentType: 'split', brand: 'Marca', model: 'Modelo', serialNumber: null, frigorias: '3000', version: 1, createdAt: '2026-10-13', archivedAt: null }
const snapshot = (): CustomerHomesSnapshot => ({ homes: [structuredClone(home)], addresses: [address], equipment: [equipment] })
let request: ReturnType<typeof vi.fn>
beforeEach(() => {
  request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ home: { ...home, version: 2 } }) })
  vi.stubGlobal('fetch', request)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Hogar client flows', () => {
  it('keeps scene geometry inputs stable when only a confirmation opens or closes', () => {
    render(<CustomerHogar initialData={snapshot()} />)
    const equipmentBefore = sceneState.equipment
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Living' }))
    expect(sceneState.equipment).toBe(equipmentBefore)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
    expect(sceneState.equipment).toBe(equipmentBefore)
    expect(request).not.toHaveBeenCalled()
  })

  it('blocks new equipment at the home limit while keeping existing equipment available', () => {
    const data = snapshot()
    data.homes[0].placements = Array.from({ length: 500 }, (_, index) => ({
      equipmentId: `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      roomId: ids.room, wall: 'north' as const, offset: 0.5, height: 2
    }))
    data.homes[0].placements[0].equipmentId = ids.air
    render(<CustomerHogar initialData={data} />)
    expect(screen.getByRole('button', { name: 'Equipos' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Reubicar Aire del living' })).toHaveProperty('disabled', false)
    expect(screen.getByText(/límite de 500/)).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('teaches the empty state without inventing homes or equipment', () => {
    render(<CustomerHogar initialData={{ homes: [], addresses: [], equipment: [] }} />)
    expect(screen.getByRole('heading', { name: 'Tu hogar, a tu manera' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Crear mi primer hogar' }))
    expect(screen.getByRole('heading', { name: 'Nuevo hogar' })).toBeTruthy()
    expect(screen.getByLabelText('Tipo de lugar')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('shows real equipment as unplaced and links to its own history', () => {
    render(<CustomerHogar initialData={snapshot()} />)
    expect(screen.getByText('Sin ubicar')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Historial de Aire del living' }).getAttribute('href')).toBe(`/app/equipos/${ids.air}`)
  })

  it('lets clients preview a room in isolation then return to the same floor', () => {
    render(<CustomerHogar initialData={snapshot()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Living' }))
    expect(screen.getByRole('button', { name: 'Volver a la planta' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Volver a la planta' }))
    expect(screen.getByLabelText('Planta actual')).toHaveProperty('value', ids.floor)
  })

  it('cancels edits without persisting or changing the room', () => {
    render(<CustomerHogar initialData={snapshot()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar Living' }))
    fireEvent.change(screen.getByLabelText('Nombre del ambiente'), { target: { value: 'Estar' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: 'Abrir Living' })).toBeTruthy()
    expect(screen.queryByText('Estar')).toBeNull()
    expect(request).not.toHaveBeenCalled()
  })

  it('saves a room rename through the authenticated home API with its expected version', async () => {
    request.mockResolvedValue({ ok: true, json: async () => ({ home: { ...home, version: 2, floors: [{ ...home.floors[0], rooms: [{ ...home.floors[0].rooms[0], name: 'Estar' }] }] } }) })
    render(<CustomerHogar initialData={snapshot()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar Living' }))
    fireEvent.change(screen.getByLabelText('Nombre del ambiente'), { target: { value: 'Estar' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ambiente' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir Estar' })).toBeTruthy())
    const [path, options] = request.mock.calls[0]
    expect(path).toBe('/api/customer/homes')
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body)).toMatchObject({ id: ids.home, expectedVersion: 1 })
  })

  it('focuses placement and cancellation keeps the equipment unplaced', () => {
    render(<CustomerHogar initialData={snapshot()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ubicar Aire del living' }))
    expect(screen.getByRole('status', { name: 'Ambiente seleccionado' }).textContent).toContain('Living')
    expect(screen.queryByLabelText('Pared')).toBeNull()
    expect(screen.queryByLabelText('Posición sobre la pared')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByText('Sin ubicar')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('keeps draft and exposes recovery when another session changed the home', async () => {
    request.mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: 'conflict' }) })
    render(<CustomerHogar initialData={snapshot()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar Living' }))
    fireEvent.change(screen.getByLabelText('Nombre del ambiente'), { target: { value: 'Estar' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ambiente' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Los datos cambiaron'))
    expect(screen.getByLabelText('Nombre del ambiente')).toHaveProperty('value', 'Estar')
    expect(screen.getByRole('button', { name: 'Recargar Hogar' })).toBeTruthy()
  })

  it('supports multiple homes and only lists the chosen floor rooms', () => {
    const secondFloor = { id: '10000000-0000-4000-8000-000000000006', name: 'Planta alta', order: 1, rooms: [] }
    const data = snapshot()
    data.homes[0].floors.push(secondFloor)
    render(<CustomerHogar initialData={data} />)
    fireEvent.change(screen.getByLabelText('Planta actual'), { target: { value: secondFloor.id } })
    expect(screen.queryByRole('button', { name: 'Abrir Living' })).toBeNull()
    expect(screen.getByText('Esta planta todavía no tiene ambientes.')).toBeTruthy()
  })

  it('offers every approved property type in setup', () => {
    render(<CustomerHogar initialData={{ homes: [], addresses: [address], equipment: [] }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Crear mi primer hogar' }))
    const select = screen.getByLabelText('Tipo de lugar')
    for (const name of ['Casa', 'Departamento', 'PH', 'Oficina', 'Local comercial']) expect(within(select).getByRole('option', { name })).toBeTruthy()
    expect(screen.getByLabelText('Tiene balcón')).toBeTruthy()
    expect(screen.getByLabelText('Tiene terraza')).toBeTruthy()
  })
})
