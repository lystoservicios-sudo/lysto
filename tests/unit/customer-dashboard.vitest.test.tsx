import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { CustomerDashboard } from '@/components/customer/customer-dashboard'
import { buildCustomerDashboardViewModel } from '@/features/customer/dashboard-view-model'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'

afterEach(() => cleanup())

describe('customer dashboard', () => {
  it('prioritizes the active service and the two primary customer actions', () => {
    const model = buildCustomerDashboardViewModel({
      customerName: customerDemoFixtures.profile.firstName,
      jobs: customerDemoFixtures.jobs,
      equipment: customerDemoFixtures.equipment,
      maintenance: customerDemoFixtures.maintenance,
      warranties: customerDemoFixtures.warranties
    })

    render(<CustomerDashboard model={model} />)

    expect(screen.getByRole('heading', { name: 'Hola, Marina' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Solicitar servicio' }).getAttribute('href')).toBe('/app/solicitar/aire-acondicionado')
    expect(screen.getByRole('link', { name: 'Ver trabajos' }).getAttribute('href')).toBe('/app/trabajos')
    expect(screen.getByText('Profesional en camino')).toBeTruthy()
    expect(screen.getByText('Profesional de demostración')).toBeTruthy()
    expect(screen.getByText('16:00 – 18:00')).toBeTruthy()
    expect(screen.getByText('Mensajería todavía no disponible')).toBeTruthy()
  })

  it('allows active-service subcards to shrink at 320px', () => {
    const model = buildCustomerDashboardViewModel({
      customerName: 'Marina',
      jobs: customerDemoFixtures.jobs,
      equipment: customerDemoFixtures.equipment,
      maintenance: customerDemoFixtures.maintenance,
      warranties: customerDemoFixtures.warranties
    })
    render(<CustomerDashboard model={model} />)

    const technicianCard = screen.getByText('Profesional de demostración').parentElement?.parentElement
    const etaCard = screen.getByText('El rango se actualizará cuando exista información nueva.').parentElement
    expect(technicianCard?.className).toContain('min-w-0')
    expect(etaCard?.className).toContain('min-w-0')
  })

  it('derives meaningful metrics from customer records', () => {
    const model = buildCustomerDashboardViewModel({
      customerName: 'Marina',
      jobs: customerDemoFixtures.jobs,
      equipment: customerDemoFixtures.equipment,
      maintenance: customerDemoFixtures.maintenance,
      warranties: customerDemoFixtures.warranties
    })

    expect(model.metrics).toEqual([
      expect.objectContaining({ id: 'active-jobs', value: 1 }),
      expect.objectContaining({ id: 'equipment', value: 2 }),
      expect.objectContaining({ id: 'maintenance', value: 1 }),
      expect.objectContaining({ id: 'warranties', value: 1 })
    ])
  })

  it('gives a new customer a useful empty state instead of empty metrics', () => {
    const model = buildCustomerDashboardViewModel({
      customerName: 'Alex',
      jobs: [],
      equipment: [],
      maintenance: [],
      warranties: []
    })

    render(<CustomerDashboard model={model} />)

    expect(screen.getByText('Tu hogar todavía no tiene actividad')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Solicitar mi primer servicio' })).toBeTruthy()
    expect(screen.queryByText('Trabajo activo')).toBeNull()
  })

  it('exposes loading and recoverable error states', () => {
    const model = buildCustomerDashboardViewModel({ customerName: 'Alex', jobs: [], equipment: [], maintenance: [], warranties: [] })
    const { rerender } = render(<CustomerDashboard model={model} state="loading" />)
    expect(screen.getByRole('status').textContent).toContain('Cargando panel del cliente')

    rerender(<CustomerDashboard model={model} state="error" onRetry={() => undefined} />)
    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar tu panel')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })
})
