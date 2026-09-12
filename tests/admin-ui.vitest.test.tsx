import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { matchesSearch, calculateSplit, adminModules } from '@/components/admin/admin-model'
import { AdminWorkspace } from '@/components/admin/admin-ui'
import { CustomersPage, RequestsPage, JobsPage } from '@/components/admin/admin-lists'
import { CandidateSelector, CustomerDetailPage } from '@/components/admin/admin-details'
import { PricesPage, NotificationsPage, SettingsForm } from '@/components/admin/admin-settings'
import { customers, requests } from '@/lib/mock/lysto-data'
import RequestDetailRoute from '@/app/(admin)/admin/solicitudes/[id]/page'
import JobDetailRoute from '@/app/(admin)/admin/trabajos/[id]/page'
import CustomerDetailRoute from '@/app/(admin)/admin/clientes/[id]/page'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/dashboard',
  notFound: () => {
    throw new Error('NOT_FOUND')
  }
}))
afterEach(cleanup)

describe('administrative UI', () => {
  it.each([
    [RequestDetailRoute, 'req_1002', 'request'],
    [JobDetailRoute, 'job_7002', 'job'],
    [CustomerDetailRoute, 'cus_002', 'customer']
  ] as const)('loads the requested record in a detail route', async (Page, id, prop) => {
    const result = await Page({ params: Promise.resolve({ id }) })
    expect(result.props[prop].id).toBe(id)
  })
  it.each([RequestDetailRoute, JobDetailRoute, CustomerDetailRoute])(
    'rejects unknown detail identifiers',
    async (Page) => {
      await expect(Page({ params: Promise.resolve({ id: 'missing-record' }) })).rejects.toThrow(
        'NOT_FOUND'
      )
    }
  )
  it('searches without requiring accents or capitalization', () => {
    expect(matchesSearch('LUCIA', ['Lucía Fernández'])).toBe(true)
    expect(matchesSearch('Belgrano', ['Palermo'])).toBe(false)
  })
  it('keeps every non-detail module discoverable', () => {
    expect(
      new Set(adminModules.flatMap((group) => group.items.map(([, route]) => route))).size
    ).toBe(21)
  })
  it('calculates the split and clamps invalid commissions', () => {
    expect(calculateSplit(35000, 18)).toEqual({ fee: 6300, professional: 28700 })
    expect(calculateSplit(100, 150)).toEqual({ fee: 100, professional: 0 })
    expect(calculateSplit(-20, 18)).toEqual({ fee: 0, professional: 0 })
  })
  it('filters requests and recovers the empty state', () => {
    render(<RequestsPage />)
    fireEvent.change(screen.getByLabelText('Buscar en solicitudes'), { target: { value: 'lucia' } })
    expect(screen.queryByText('Mariano Díaz')).toBeNull()
    expect(screen.getByText('Lucía Fernández')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Buscar en solicitudes'), {
      target: { value: 'no existe' }
    })
    expect(screen.getByText('No encontramos resultados')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByText('Mariano Díaz')).toBeTruthy()
  })
  it('applies request status tabs', () => {
    render(<RequestsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Pendiente de pago' }))
    expect(screen.getByText('Carla Núñez')).toBeTruthy()
    expect(screen.queryByText('Lucía Fernández')).toBeNull()
  })
  it('links customers using their customer IDs', () => {
    render(<CustomersPage />)
    const row = screen.getByText('Mariano Díaz').closest('tr')!
    expect(within(row).getByRole('link', { name: 'Ver ficha' }).getAttribute('href')).toBe(
      '/admin/clientes/cus_002'
    )
  })
  it('shows the selected customer and only their requests', () => {
    render(<CustomerDetailPage customer={customers[1]} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Mariano Díaz')
    expect(screen.queryByText('Lucía Fernández')).toBeNull()
    expect(screen.getByText('LG · S4-W12JA3AA')).toBeTruthy()
  })
  it('switches the job list to an agenda', () => {
    render(<JobsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Agenda' }))
    expect(screen.getByRole('heading', { name: 'Agenda de visitas' })).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
  it('does not allow assignment of unpaid requests', () => {
    render(<CandidateSelector request={requests[2]} />)
    fireEvent.click(screen.getAllByRole('radio')[0])
    expect(
      (screen.getByRole('button', { name: 'Guardar selección' }) as HTMLButtonElement).disabled
    ).toBe(true)
  })
  it('saves candidate choices as explicitly local drafts', () => {
    render(
      <AdminWorkspace>
        <CandidateSelector request={requests[0]} />
      </AdminWorkspace>
    )
    fireEvent.click(screen.getAllByRole('radio')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Guardar selección' }))
    expect(screen.getByRole('status').textContent).toContain('No se realizó una asignación real')
  })
  it('updates the price preview from input and priority', () => {
    render(
      <AdminWorkspace>
        <PricesPage />
      </AdminWorkspace>
    )
    fireEvent.change(screen.getByLabelText('Visita de diagnóstico · ARS'), {
      target: { value: '40000' }
    })
    fireEvent.click(screen.getByLabelText('Atención prioritaria'))
    expect(screen.getByText(/50.000/)).toBeTruthy()
  })
  it('restores a saved session draft when a form remounts', () => {
    const fields = [{ key: 'name', label: 'Nombre de prueba', value: 'Original' }]
    const { rerender } = render(
      <AdminWorkspace>
        <SettingsForm storageKey="test" fields={fields} />
      </AdminWorkspace>
    )
    fireEvent.change(screen.getByLabelText('Nombre de prueba'), { target: { value: 'Editado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    rerender(
      <AdminWorkspace>
        <p>Otra pantalla</p>
      </AdminWorkspace>
    )
    rerender(
      <AdminWorkspace>
        <SettingsForm storageKey="test" fields={fields} />
      </AdminWorkspace>
    )
    expect((screen.getByLabelText('Nombre de prueba') as HTMLInputElement).value).toBe('Editado')
  })
  it('toggles notification preferences without sending messages', () => {
    render(
      <AdminWorkspace>
        <NotificationsPage />
      </AdminWorkspace>
    )
    const checkbox = screen.getByLabelText('Email: Solicitud creada') as HTMLInputElement
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar preferencias' }))
    expect(screen.getByRole('status').textContent).toContain('esta sesión')
  })
})
