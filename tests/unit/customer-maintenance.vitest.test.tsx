import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectedCustomerMaintenance } from '@/components/customer/connected-customer-maintenance'

const id = '10000000-0000-4000-8000-000000000001'
const equipmentId = '10000000-0000-4000-8000-000000000002'
const sourceJobId = '10000000-0000-4000-8000-000000000003'
const plan = {
  id, equipmentId, equipmentName: 'Aire del living', recommendation: 'filters_60_days',
  dueAt: '2026-11-14', status: 'planned', version: 4, sourceJobId,
  activeJobId: null, contextVerified: true, superseded: false,
  history: [{ id: 'record-1', jobId: sourceJobId, performedAt: '2026-09-14T15:00:00Z',
    diagnosis: 'Filtros sucios', workDone: 'Limpieza completa', professionalId: null }]
}
let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn(async () => Response.json({ maintenance: [plan] }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('customer maintenance', () => {
  it('names care and dates, and opens Pedir for the owned air without making a request', async () => {
    render(<ConnectedCustomerMaintenance />)
    expect(await screen.findByText('Aire del living')).toBeInTheDocument()
    expect(screen.getByText('Limpieza de filtros en 60 días')).toBeInTheDocument()
    expect(screen.getByText(/14 de noviembre de 2026/)).toBeInTheDocument()
    expect(screen.queryByText(/filters_60_days|planned|Dirección actual \(ID\)/)).not.toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Pedir mantenimiento' })
    expect(link).toHaveAttribute('href', `/app/solicitar/aire-acondicionado?problema=mantenimiento&equipo=${equipmentId}`)
    link.addEventListener('click', (event) => event.preventDefault())
    fireEvent.click(link)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET' })
  })

  it.each([
    { status: 'suppressed_by_case' }, { status: 'completed' }, { status: 'cancelled' },
    { contextVerified: false }, { superseded: true }
  ])('does not offer another maintenance or defer for blocked context %j', async (change) => {
    fetchMock.mockResolvedValue(Response.json({ maintenance: [{ ...plan, ...change }] }))
    render(<ConnectedCustomerMaintenance />)
    if ('superseded' in change) await screen.findByText('Sin mantenimientos pendientes')
    else await screen.findByText('Aire del living')
    await waitFor(() => expect(screen.queryByText('Cargando mantenimientos…')).not.toBeInTheDocument())
    expect(screen.queryByRole('link', { name: 'Pedir mantenimiento' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cambiar fecha recomendada' })).not.toBeInTheDocument()
    if (change.status === 'suppressed_by_case') {
      expect(screen.getByRole('link', { name: 'Ver garantías y reclamos' })).toHaveAttribute('href', '/app/garantias')
    }
  })

  it('continues a current service instead of selling a duplicate maintenance', async () => {
    fetchMock.mockResolvedValue(Response.json({ maintenance: [{ ...plan, activeJobId: sourceJobId }] }))
    render(<ConnectedCustomerMaintenance />)
    expect(await screen.findByRole('link', { name: 'Ver servicio en curso' })).toHaveAttribute('href', `/app/trabajos/${sourceJobId}`)
    expect(screen.queryByRole('link', { name: 'Pedir mantenimiento' })).not.toBeInTheDocument()
  })

  it.each(['pending_part_replacement', 'second_visit_recommended'])('keeps %s within the originating service', async (recommendation) => {
    fetchMock.mockResolvedValue(Response.json({ maintenance: [{ ...plan, recommendation }] }))
    render(<ConnectedCustomerMaintenance />)
    expect(await screen.findByRole('link', { name: 'Ver servicio de origen' })).toHaveAttribute('href', `/app/trabajos/${sourceJobId}`)
    expect(screen.queryByRole('link', { name: 'Pedir mantenimiento' })).not.toBeInTheDocument()
  })

  it('does not present a legacy requested plan as a booked visit', async () => {
    fetchMock.mockResolvedValue(Response.json({ maintenance: [{ ...plan, status: 'requested' }] }))
    render(<ConnectedCustomerMaintenance />)
    expect(await screen.findByText(/Todavía no hay una visita confirmada/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pedir mantenimiento' })).toBeInTheDocument()
  })

  it('defers with the current version and preserves the selected date after failure', async () => {
    fetchMock.mockImplementation(async (_path: string, options: RequestInit) => options.method === 'GET'
      ? Response.json({ maintenance: [plan] })
      : Response.json({ code: 'conflict' }, { status: 409 }))
    render(<ConnectedCustomerMaintenance />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar fecha recomendada' }))
    const date = screen.getByLabelText('Nueva fecha recomendada')
    fireEvent.change(date, { target: { value: '2099-11-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar fecha' }))
    await screen.findByRole('alert')
    expect(date).toHaveValue('2099-11-20')
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST',
      body: JSON.stringify({ planId: id, action: 'defer', expectedVersion: 4, dueDate: '2099-11-20' }) })
    expect(screen.getByRole('button', { name: 'Actualizar información' })).toBeInTheDocument()
  })

  it('keeps technical history readable and linked to its existing service', async () => {
    render(<ConnectedCustomerMaintenance />)
    fireEvent.click(await screen.findByText('Historial técnico (1)'))
    expect(screen.getByText('Filtros sucios')).toBeInTheDocument()
    expect(screen.getByText('Limpieza completa')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver detalle del servicio' })).toHaveAttribute('href', `/app/trabajos/${sourceJobId}`)
  })
})
