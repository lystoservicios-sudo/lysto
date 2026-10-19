import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomerHogar } from '@/components/customer/hogar/customer-hogar'
import type { HomeSceneProps } from '@/components/customer/hogar/home-scene'
import type { CustomerHome } from '@/lib/customer-homes/contracts'

vi.mock('next/navigation', () => ({ usePathname: () => '/app/hogar' }))
vi.mock('next/dynamic', () => ({ default: () => (props: HomeSceneProps) => <div>
  {props.roomAdditions?.map(slot => <button key={slot.id} onClick={() => props.onAddRoom?.(slot)}>{slot.label}</button>)}
  <button onClick={() => props.onUnavailable?.()}>Sin GPU</button>
</div> }))
const home: CustomerHome = { id: '10000000-0000-4000-8000-000000000001', addressId: '10000000-0000-4000-8000-000000000002', name: 'Mi casa', kind: 'house', building: null, features: { balcony: false, terrace: false, windows: 'large' }, version: 1, placements: [], floors: [{ id: '10000000-0000-4000-8000-000000000003', name: 'Planta baja', order: 0, rooms: [{ id: '10000000-0000-4000-8000-000000000004', name: 'Living', kind: 'living', variant: 'compact', x: 0, z: 0, width: 4, depth: 4, rotation: 0, windows: 'large' }] }] }
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const chooseKind = (value: string) => fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de ambiente' }), { target: { value } })
let request: ReturnType<typeof vi.fn>
beforeEach(() => {
  request = vi.fn(async (_url, options) => { const { expectedVersion, ...value } = JSON.parse(options.body); return new Response(JSON.stringify({ home: { ...value, version: expectedVersion + 1 } })) })
  vi.stubGlobal('fetch', request)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function setup(empty = false) {
  const initial = structuredClone(home)
  if (empty) initial.floors[0].rooms = []
  render(<CustomerHogar initialData={{ homes: [initial], addresses: [], equipment: [] }} />)
  click('Ambientes')
}

describe('visual room creation', () => {
  it('chooses a side before opening a simple modal and saves the chosen variant there', async () => {
    setup()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Añadir ambiente / })).toHaveLength(4)
    click('Añadir ambiente a la derecha de Living')
    const modal = screen.getByRole('dialog', { name: 'Nuevo ambiente' })
    expect(document.activeElement).toBe(within(modal).getByRole('button', { name: 'Cerrar diálogo' }))
    for (const label of ['Nombre del ambiente', 'Ancho', 'Profundidad', 'Orientación', 'Ventanas del ambiente', 'Variante']) expect(within(modal).queryByLabelText(label)).toBeNull()
    chooseKind('bedroom'); click('Variante siguiente')
    expect(within(modal).getByText('Dos camas')).toBeTruthy()
    click('Añadir ambiente')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ambientes' })))
    const body = JSON.parse(request.mock.calls[0][1].body)
    expect(body.expectedVersion).toBe(1)
    expect(body.floors[0].rooms[1]).toMatchObject({ name: 'Dormitorio', kind: 'bedroom', variant: 'double', x: 4.15, z: 0, rotation: 0 })
    expect(body.floors[0].rooms[0]).toEqual(home.floors[0].rooms[0])
  })
  it('opens the picker directly on an empty floor and cancels without writing', () => {
    setup(true)
    expect(screen.getByRole('dialog', { name: 'Nuevo ambiente' })).toBeTruthy()
    chooseKind('kitchen'); click('Cancelar')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(request).not.toHaveBeenCalled()
  })
  it('supports keyboard variants and keeps the draft visible after a failed save', async () => {
    request.mockResolvedValue(new Response(JSON.stringify({ code: 'conflict' }), { status: 409 }))
    setup(true)
    chooseKind('bedroom')
    fireEvent.keyDown(screen.getByRole('region', { name: 'Variantes del ambiente' }), { key: 'ArrowLeft' })
    expect(screen.getByText('Huéspedes')).toBeTruthy()
    click('Añadir ambiente')
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toContain('Los datos cambiaron'))
    expect(screen.getByText('Huéspedes')).toBeTruthy()
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Recargar Hogar' })).toBeTruthy()
  })
  it('keeps location selection available without WebGL', () => {
    setup()
    click('Sin GPU')
    click('Añadir ambiente a la izquierda de Living')
    expect(screen.getByRole('dialog', { name: 'Nuevo ambiente' })).toBeTruthy()
    click('Cancelar')
    click('Cancelar ubicación')
    expect(screen.queryByRole('button', { name: 'Añadir ambiente a la izquierda de Living' })).toBeNull()
  })
  it('changes variants with horizontal swipes and ignores vertical drags', () => {
    class Pointer extends MouseEvent {
      pointerId = 1
      isPrimary = true
    }
    vi.stubGlobal('PointerEvent', Pointer)
    setup(true)
    chooseKind('bedroom')
    const swipe = screen.getByRole('region', { name: 'Variantes del ambiente' }).firstElementChild!
    fireEvent.pointerDown(swipe, { clientX: 180, clientY: 60, button: 0 })
    fireEvent.pointerUp(swipe, { clientX: 80, clientY: 65, button: 0 })
    expect(screen.getByText('Dos camas')).toBeTruthy()
    fireEvent.pointerDown(swipe, { clientX: 80, clientY: 65, button: 0 })
    fireEvent.pointerUp(swipe, { clientX: 180, clientY: 60, button: 0 })
    expect(screen.getByText('Principal')).toBeTruthy()
    fireEvent.pointerDown(swipe, { clientX: 180, clientY: 60, button: 0 })
    fireEvent.pointerUp(swipe, { clientX: 120, clientY: 160, button: 0 })
    expect(screen.getByText('Principal')).toBeTruthy()
  })
  it('saves the first room at the origin and automatically enables exterior features', async () => {
    setup(true)
    chooseKind('balcony'); click('Añadir ambiente')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const body = JSON.parse(request.mock.calls[0][1].body)
    expect(body.features.balcony).toBe(true)
    expect(body.floors[0].rooms).toEqual([expect.objectContaining({ kind: 'balcony', x: 0, z: 0, rotation: 0 })])
  })
})
