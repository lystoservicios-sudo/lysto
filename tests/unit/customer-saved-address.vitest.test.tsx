import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomerHomesSnapshot } from '@/lib/customer-homes/contracts'
const mocks = vi.hoisted(() => ({ session: vi.fn(), homes: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ requirePageSession: mocks.session }))
vi.mock('@/lib/customer-homes/service', () => ({ readCustomerHomes: mocks.homes }))
import RequestPage from '@/app/(customer)/app/solicitar/aire-acondicionado/page'
import { AirConditioningWizard } from '@/features/service-request/air-conditioning-wizard'

const actor = '30000000-0000-4000-8000-000000000001'
const addressId = '30000000-0000-4000-8000-000000000002'
const equipmentId = '30000000-0000-4000-8000-000000000003'
const homeId = '30000000-0000-4000-8000-000000000004'
const floorId = '30000000-0000-4000-8000-000000000005'
const roomId = '30000000-0000-4000-8000-000000000006'
beforeEach(() => { window.sessionStorage.clear(); vi.resetAllMocks() })
afterEach(cleanup)
function reachLocation() { fireEvent.click(screen.getByRole('radio', { name: /No enfría/ })); fireEvent.click(screen.getByRole('button', { name: 'Continuar' })) }
describe('saved service address integration', () => {
  it('shows the authenticated address and preserves declared access details without writing on selection', async () => {
    const snapshot: CustomerHomesSnapshot = {
      addresses: [{ id: addressId, label: 'Mi hogar', isDefault: true, archivedAt: null, street: 'San Martín', number: '932', floor: '2', apartment: 'C', city: 'Vicente López', province: 'Buenos Aires', propertyType: 'office', access: { hasElevator: true, hasParking: true, stairsRequired: false, outdoorUnitAtHeight: true, outdoorUnitOnBalcony: true, difficultAccess: true }, version: 1, createdAt: '2026-10-13T12:00:00Z' }],
      equipment: [{ id: equipmentId, addressId, nickname: 'Aire oficina', equipmentType: 'inverter', brand: null, model: null, serialNumber: null, frigorias: '3000', version: 1, createdAt: '2026-10-13T12:00:00Z', archivedAt: null }],
      homes: [{ id: homeId, name: 'Mi oficina', addressId, kind: 'office', building: null, features: { balcony: true, terrace: false, windows: 'small' }, version: 1, floors: [{ id: floorId, name: 'Planta principal', order: 0, rooms: [{ id: roomId, name: 'Oficina', kind: 'office', variant: 'individual', x: 0, z: 0, width: 4, depth: 4, rotation: 0, windows: 'small' }] }], placements: [{ equipmentId, roomId, wall: 'north', offset: .5, height: 2 }] }]
    }
    mocks.session.mockResolvedValue({ role: 'customer', profileId: 'owner', customerId: actor })
    mocks.homes.mockResolvedValue(snapshot)
    render(await RequestPage({})); reachLocation()
    expect(screen.getByText('San Martín 932 · Piso 2 · C, Vicente López')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect((screen.getByLabelText('Calle') as HTMLInputElement).value).toBe('San Martín')
    expect((screen.getByLabelText('Número') as HTMLInputElement).value).toBe('932')
    expect((screen.getByLabelText('Piso de la dirección') as HTMLInputElement).value).toBe('2')
    expect((screen.getByLabelText('Departamento / unidad') as HTMLInputElement).value).toBe('C')
    fireEvent.click(screen.getByText('Condiciones de acceso'))
    expect((screen.getByLabelText('Hay estacionamiento') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('La unidad exterior está en un balcón') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Se requieren escaleras') as HTMLInputElement).checked).toBe(false)
  })
  it('leaves an absent address empty and requires a real saved location before scheduling', () => {
    render(<AirConditioningWizard customerId={actor} />); reachLocation()
    expect((screen.getByRole('button', { name: 'Continuar con los detalles' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Añadir hogar' }))
    expect((screen.getByLabelText('Calle') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Número') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Piso de la dirección') as HTMLInputElement).value).toBe('')
  })
})
