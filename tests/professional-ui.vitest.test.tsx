import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Dashboard from '@/app/(professional)/pro/dashboard/page'
import Requests from '@/app/(professional)/pro/solicitudes/page'
import Jobs from '@/app/(professional)/pro/trabajos/page'
import Agenda from '@/app/(professional)/pro/agenda/page'
import Payments from '@/app/(professional)/pro/pagos/page'
import Profile from '@/app/(professional)/pro/perfil/page'
import Training from '@/app/(professional)/pro/capacitacion/page'
import Support from '@/app/(professional)/pro/soporte/page'
import MercadoPago from '@/app/(professional)/pro/mercadopago/page'
import Onboarding from '@/app/(professional)/pro/onboarding/[token]/page'
import RequestRoute from '@/app/(professional)/pro/solicitudes/[id]/page'
import JobRoute from '@/app/(professional)/pro/trabajos/[id]/page'
import EquipmentRoute from '@/app/(professional)/pro/equipos/[id]/page'

vi.mock('next/navigation', () => ({ usePathname: () => '/pro/dashboard', notFound: () => { throw new Error('NOT_FOUND') } }))
afterEach(() => { cleanup(); sessionStorage.clear() })

describe('professional mobile experience', () => {
  it.each([[Dashboard, 'Tu jornada'], [Requests, 'Solicitudes disponibles'], [Jobs, 'Mis trabajos'], [Agenda, 'Mi agenda'], [Payments, 'Mis cobros'], [Profile, 'Mi perfil'], [Training, 'Aprendé a tu ritmo'], [Support, '¿En qué te ayudamos?'], [MercadoPago, 'Tu cuenta de Mercado Pago']] as const)('renders the redesigned route', (Page, title) => {
    render(<Page />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title)
  })
  it('does not mix another professional into personal jobs', () => {
    render(<Jobs />)
    expect(screen.queryByText('Carla Núñez')).toBeNull()
  })
  it('filters jobs and can recover from an empty search', () => {
    render(<Jobs />)
    fireEvent.change(screen.getByLabelText('Buscar trabajos'), { target: { value: 'no-existe' } })
    expect(screen.getByText('No encontramos trabajos')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByText('Lucía Fernández')).toBeTruthy()
  })
  it('filters completed jobs through accessible tabs', () => {
    render(<Jobs />)
    fireEvent.click(screen.getByRole('tab', { name: /Finalizados/ }))
    expect(screen.getByText('Mariano Díaz')).toBeTruthy()
    expect(screen.queryByText('Lucía Fernández')).toBeNull()
  })
  it('does not offer unpaid requests', () => {
    render(<Requests />)
    expect(screen.queryByText('Carla Núñez')).toBeNull()
  })
  it('does not label captured payments as available for transfer', () => {
    render(<Payments />)
    expect(screen.queryByText('Disponible para transferencia')).toBeNull()
    expect(screen.queryByText('Carla Núñez')).toBeNull()
  })
  it('saves and restores an explicitly local profile draft', () => {
    const view = render(<Profile />)
    fireEvent.change(screen.getByLabelText('Zona de trabajo'), { target: { value: 'Palermo y Belgrano' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador de perfil' }))
    expect(screen.getByRole('status').textContent).toContain('No se envió')
    view.unmount()
    render(<Profile />)
    expect((screen.getByLabelText('Zona de trabajo') as HTMLInputElement).value).toBe('Palermo y Belgrano')
  })
  it('reports storage failures without claiming a save', () => {
    render(<Profile />)
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador de perfil' }))
    expect(screen.getByRole('alert').textContent).toContain('No se pudo guardar')
    blocked.mockRestore()
  })
  it('lets the professional mark a guide read locally', () => {
    render(<Training />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Marcar como leída' })[0])
    expect(screen.getByText('1 de 6 guías leídas')).toBeTruthy()
  })
  it('filters support answers without an inert help button', () => {
    render(<Support />)
    fireEvent.change(screen.getByLabelText('Buscar ayuda'), { target: { value: 'reprogramar' } })
    expect(screen.getByText('¿Necesitás reprogramar una visita?')).toBeTruthy()
    expect(screen.queryByText('¿Cuándo se acredita un cobro?')).toBeNull()
  })
  it('starts onboarding at a short personal-data step without claiming token validity', () => {
    render(<Onboarding />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Empezá tu perfil profesional')
    expect(screen.getByText(/La invitación todavía no se valida/)).toBeTruthy()
    expect(screen.getByLabelText('Nombre y apellido')).toBeTruthy()
    expect(screen.queryByLabelText('Zona de trabajo')).toBeNull()
  })
  it.each([[RequestRoute, 'req_1002', 'request'], [JobRoute, 'job_7003', 'job'], [EquipmentRoute, 'eq_003', 'item']] as const)('resolves the actual detail ID', async (Page, id, prop) => {
    const route = Page as unknown as (p: { params: Promise<{ id: string }> }) => Promise<{ props: Record<string, { id: string }> }>
    const result = await route({ params: Promise.resolve({ id }) })
    expect(result.props[prop]?.id).toBe(id)
  })
  it.each([RequestRoute, JobRoute, EquipmentRoute])('does not show a fixture for an unknown ID', async Page => {
    const route = Page as unknown as (p: { params: Promise<{ id: string }> }) => Promise<unknown>
    await expect(Promise.resolve().then(() => route({ params: Promise.resolve({ id: 'missing' }) }))).rejects.toThrow('NOT_FOUND')
  })
})
