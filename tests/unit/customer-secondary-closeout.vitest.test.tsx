import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomerRequestSummaryCard } from '@/components/customer/customer-request-summary-card'
import { CustomerRequestList } from '@/components/customer/customer-request-list'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'

const mocks = vi.hoisted(() => ({ session: vi.fn(), addresses: vi.fn(), equipment: vi.fn(), history: vi.fn(), requests: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ requirePageSession: mocks.session }))
vi.mock('@/lib/customer-assets/service', () => ({ listCustomerAddresses: mocks.addresses, listCustomerEquipment: mocks.equipment, customerEquipmentHistory: mocks.history }))
vi.mock('@/lib/customer/live-model', () => ({ listCustomerRequestsLive: mocks.requests }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), notFound: () => { throw new Error('NEXT_NOT_FOUND') } }))

import AddressesPage from '@/app/(customer)/app/direcciones/page'
import EquipmentPage from '@/app/(customer)/app/equipos/page'
import EquipmentDetailPage from '@/app/(customer)/app/equipos/[id]/page'
import ArchivedEquipmentPage from '@/app/(customer)/app/equipos/archivo/page'
import RequestsPage from '@/app/(customer)/app/solicitudes/page'
import QuotesPage from '@/app/(customer)/app/presupuestos/page'

const equipmentId = '71000000-0000-4000-8000-000000000001'
const addressId = '71000000-0000-4000-8000-000000000002'
const address = { id: addressId, label: 'Mi casa', street: 'Lavalle', number: '123', city: 'CABA', province: 'Buenos Aires', propertyType: 'house', isDefault: true, access: {}, version: 4, createdAt: '2026-10-01', archivedAt: null }
const equipment = { id: equipmentId, nickname: 'Aire del living', addressId, equipmentType: 'split', brand: 'Marca real', model: 'Modelo real', serialNumber: null, frigorias: '3000', version: 2, createdAt: '2026-10-01', archivedAt: null }
const emptyPage = { items: [], total: 0, nextCursor: null }
const draft = { ...customerDemoFixtures.requests[0], id: '71000000-0000-4000-8000-000000000003', status: 'draft' as const, statusView: { label: 'Borrador', tone: 'neutral' as const }, nextStep: 'Continuar la solicitud' }

beforeEach(() => {
  mocks.session.mockResolvedValue({ customerId: 'owner' })
  mocks.addresses.mockResolvedValue({ items: [address], total: 1, nextCursor: null })
  mocks.equipment.mockResolvedValue({ items: [equipment], total: 1, nextCursor: null })
  mocks.requests.mockResolvedValue({ ...emptyPage, items: [draft], nextCursor: 'older' })
  mocks.history.mockResolvedValue({ equipment: { id: equipmentId, nickname: 'Aire del living', brand: 'Marca real', model: 'Modelo real', equipment_type: 'split', serial_number: 'SERIE-REAL', frigorias: '3000', archived_at: null }, items: [{ id: 'record', created_at: '2026-10-01T14:00:00Z', reported_problem: 'Revisión de drenaje', real_diagnosis: 'Drenaje obstruido', work_done: 'Drenaje limpio', parts_used: null, next_maintenance_date: null }], nextCursor: 'history cursor' })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ quotes: [], nextCursor: null }), { status: 200 })))
})
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals() })

describe('customer secondary navigation and preserved content', () => {
  it('grounds addresses in Hogar and keeps the real editable data', async () => {
    render(await AddressesPage())
    expect(screen.getByRole('link', { name: 'Volver a Hogar' }).getAttribute('href')).toBe('/app/hogar')
    expect(screen.getByRole('heading', { level: 1, name: 'Direcciones y accesos' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Editar Mi casa' }))
    expect((screen.getByLabelText('Calle *') as HTMLInputElement).value).toBe('Lavalle')
    expect(screen.getByRole('button', { name: 'Guardar dirección' })).toBeTruthy()
  })
  it('grounds equipment in Hogar without losing registration or archive navigation', async () => {
    render(await EquipmentPage())
    expect(screen.getByRole('link', { name: 'Volver a Hogar' }).getAttribute('href')).toBe('/app/hogar')
    expect(screen.getByRole('heading', { level: 1, name: 'Mis equipos' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /equipos archivados/i }).getAttribute('href')).toBe('/app/equipos/archivo')
    expect(screen.getByLabelText('Nombre del equipo')).toBeTruthy()
  })
  it('keeps equipment history, safe technical data, photos and cursor navigation', async () => {
    render(await EquipmentDetailPage({ params: Promise.resolve({ id: equipmentId }), searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('link', { name: 'Volver a mis equipos' }).getAttribute('href')).toBe('/app/equipos')
    expect(screen.getByRole('heading', { name: 'Ficha del equipo' })).toBeTruthy()
    expect(screen.getByText('SERIE-REAL')).toBeTruthy()
    expect(screen.getByText('Diagnóstico: Drenaje obstruido')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver historial anterior' }).getAttribute('href')).toContain('history%20cursor')
    expect(screen.getByRole('button', { name: 'Consultar fotos guardadas' })).toBeTruthy()
  })
  it('keeps archived equipment read-only and connects the preserved history', async () => {
    render(await ArchivedEquipmentPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('link', { name: 'Volver a mis equipos' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Aire del living/ }).getAttribute('href')).toBe(`/app/equipos/${equipmentId}`)
    expect(screen.queryByRole('button', { name: /Registrar|Restaurar|Archivar/ })).toBeNull()
  })
  it('connects requests to Servicios with honest copy and preserves pagination', async () => {
    render(await RequestsPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('link', { name: 'Volver a Servicios' }).getAttribute('href')).toBe('/app/trabajos')
    expect(screen.queryByText(/Revisá borradores/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Ver solicitudes anteriores' }).getAttribute('href')).toBe('/app/solicitudes?cursor=older')
  })
  it('connects saved quotes to Servicios and retains a single primary page title', async () => {
    render(await QuotesPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('link', { name: 'Volver a Servicios' }).getAttribute('href')).toBe('/app/trabajos')
    expect(screen.getByRole('heading', { level: 1, name: 'Mis presupuestos' })).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})

describe('unsubmitted historical requests', () => {
  it('does not promise recovery or link to a job-only detail for an unsubmitted request', () => {
    render(<ul><CustomerRequestSummaryCard request={draft} /></ul>)
    expect(document.querySelector(`a[href="/app/solicitudes/${draft.id}"]`)).toBeNull()
    expect(screen.queryByText('Continuar la solicitud')).toBeNull()
    expect(screen.getByText('Solicitud sin enviar')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Pedir un nuevo servicio' }).getAttribute('href')).toBe('/app/solicitar/aire-acondicionado')
  })
  it('labels the historical list filter without offering a draft editor', () => {
    render(<CustomerRequestList requests={[draft]} />)
    expect(screen.queryByRole('button', { name: /Borradores/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sin enviar 1' }))
    expect(screen.getByText('Solicitud sin enviar')).toBeTruthy()
  })
  it('routes submitted records to the canonical Servicios center instead of assuming a job exists', () => {
    const submitted = { ...draft, status: 'pending_assignment' as const, statusView: { label: 'Enviada', tone: 'brand' as const } }
    render(<ul><CustomerRequestSummaryCard request={submitted} /></ul>)
    expect(screen.getByRole('link', { name: 'Ver en Servicios' }).getAttribute('href')).toBe('/app/trabajos')
    expect(document.querySelector(`a[href="/app/solicitudes/${submitted.id}"]`)).toBeNull()
  })
})
