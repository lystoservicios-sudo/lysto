import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CustomerDashboard } from '@/components/customer/customer-dashboard'
import { HomeSetupInvite } from '@/components/customer/home-setup-invite'
import {
  buildCustomerHomeViewModel,
  type CustomerHomeSource,
  type HomeDataset
} from '@/features/customer/home-view-model'

const ready = <T,>(items: T[]): HomeDataset<T> => ({ state: 'ready', items })
const count = (value: number): HomeDataset<number> => ({ state: 'ready', items: [value] })
function source(overrides: Partial<CustomerHomeSource> = {}): CustomerHomeSource {
  return {
    preferenceScope: 'profile-a', now: '2026-10-12T12:00:00.000Z',
    quotes: ready([]), requests: ready([]), jobs: ready([]), checkouts: ready([]),
    addresses: count(1), equipment: count(1), maintenance: ready([]), supportCases: ready([]),
    ...overrides
  }
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('customer home', () => {
  it('renders the approved home hierarchy with a decision and compact issue shortcuts', () => {
    const model = buildCustomerHomeViewModel(source({ quotes: ready([{
      id: 'quote-ready', requestId: null, status: 'ready', scope: 'Reparación', total: 40000,
      expiresAt: '2026-10-20T12:00:00.000Z', createdAt: '2026-10-11T12:00:00.000Z'
    }]) }))
    render(<CustomerDashboard model={model} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Inicio' })).toBeTruthy()
    expect(screen.queryByText(/Hola,|Marina/)).toBeNull()
    expect(screen.getByRole('link', { name: /Revisar presupuesto/ }).getAttribute('href')).toBe('/app/presupuestos#presupuesto-quote-ready')
    expect(screen.getByRole('heading', { name: 'Presupuesto listo' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '¿Qué necesitás?' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Problemas y servicios de aire acondicionado' }).querySelectorAll('a')).toHaveLength(7)
    expect(screen.getByRole('link', { name: 'No enfría' }).getAttribute('href')).toBe('/app/solicitar/aire-acondicionado?problema=no_enfria')
    expect(screen.getByRole('link', { name: 'No calienta' }).getAttribute('href')).toBe('/app/solicitar/aire-acondicionado?problema=no_funciona_calor')
    expect(screen.getByRole('link', { name: 'No sé qué le pasa' }).getAttribute('href')).toBe('/app/solicitar/aire-acondicionado')
    expect(screen.getByRole('link', { name: /¿Necesitás ayuda?/ }).getAttribute('href')).toBe('/app/mas')
    expect(screen.queryByText('Trabajo activo')).toBeNull()
  })

  it('formats a confirmed visit in the declared Buenos Aires timezone', () => {
    const model = buildCustomerHomeViewModel(source({
      jobs: ready([{
        id: 'job-visit', requestId: 'request-visit', status: 'confirmed', issueLabel: 'Mantenimiento',
        equipmentName: 'Aire del living', nextStep: 'Esperar la visita', createdAt: '2026-10-10T12:00:00.000Z',
        visitState: 'ready', visit: {
          startsAt: '2026-10-15T16:00:00.000Z', endsAt: '2026-10-15T18:00:00.000Z',
          timezone: 'America/Argentina/Buenos_Aires', professionalName: 'Lucía Fernández'
        }
      }]),
      checkouts: ready([{ jobId: 'job-visit', extraId: null, status: 'approved' }])
    }))
    render(<CustomerDashboard model={model} />)

    expect(screen.getByText('Aire del living')).toBeTruthy()
    expect(screen.getByText('Lucía Fernández')).toBeTruthy()
    expect(screen.getByText(/13:00–15:00/)).toBeTruthy()
  })

  it('keeps stable actions available while reporting a partial data error', () => {
    const model = buildCustomerHomeViewModel(source({ jobs: { state: 'error', label: 'trabajos' } }))
    render(<CustomerDashboard model={model} />)

    expect(screen.getByRole('status').textContent).toContain('parte de tu información')
    expect(screen.getByRole('link', { name: 'Instalación' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Reintentar' }).getAttribute('href')).toBe('/app')
  })

  it('keeps the quiet state focused on services and order destinations', () => {
    render(<CustomerDashboard model={buildCustomerHomeViewModel(source())} />)
    expect(screen.getByRole('link', { name: 'Mantenimiento' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Tu actividad' })).toBeNull()
    expect(screen.queryByText('Gestioná tu hogar')).toBeNull()
    expect(screen.queryByText('Trabajo activo')).toBeNull()
  })

  it('supports keyboard access to every problem without automatically selecting or navigating', () => {
    render(<CustomerDashboard model={buildCustomerHomeViewModel(source())} />)
    const first = screen.getByRole('link', { name: 'No enfría' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Pierde agua' }))
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Mantenimiento' }))
    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    expect(document.activeElement).toBe(first)
  })

  it('keeps a second important decision accessible instead of hiding it in the carousel', () => {
    const quotes = ['first', 'second'].map(id => ({
      id, requestId: null, status: 'ready', scope: `Equipo ${id}`, total: 40000,
      expiresAt: '2026-10-20T12:00:00.000Z', createdAt: '2026-10-11T12:00:00.000Z'
    }))
    render(<CustomerDashboard model={buildCustomerHomeViewModel(source({ quotes: ready(quotes) }))} />)
    expect(screen.getAllByRole('link', { name: /Revisar presupuesto/ })).toHaveLength(2)
  })

  it('renders a real household summary and service without claiming an unverified report', () => {
    const model = {
      ...buildCustomerHomeViewModel(source()),
      household: {
        id: 'equipment-living', title: 'Aire del living', description: 'Cuidado recomendado',
        action: { label: 'Ver cuidado', href: '/app/mantenimientos' }, maintenanceId: 'maintenance-living'
      },
      lastService: {
        id: 'job-completed', title: 'Mantenimiento', completedAt: '2026-09-28T17:00:00.000Z',
        action: { label: 'Ver servicio', href: '/app/trabajos/job-completed' }
      }
    }
    render(<CustomerDashboard model={model} />)
    expect(screen.getByRole('heading', { name: 'Tu hogar' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Aire del living/ }).getAttribute('href')).toBe('/app/mantenimientos')
    expect(screen.getByRole('heading', { name: 'Último servicio' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Mantenimiento.*28 sep/ }).getAttribute('href')).toBe('/app/trabajos/job-completed')
    expect(screen.queryByText('Informe disponible')).toBeNull()
  })

  it('does not repeat the household care reminder as another operational card', () => {
    const model = buildCustomerHomeViewModel(source({ maintenance: ready([{
      id: 'care', equipmentName: 'Aire del living', recommendation: 'filters_30_days',
      dueAt: '2026-11-12T00:00:00.000Z', status: 'scheduled', sourceJobId: null
    }]) }))
    render(<CustomerDashboard model={{ ...model, household: {
      id: 'equipment', title: 'Aire del living', description: 'Mantenimiento recomendado',
      action: { label: 'Ver cuidado', href: '/app/mantenimientos' }, maintenanceId: 'care'
    } }} />)
    expect(screen.getAllByText('Aire del living')).toHaveLength(1)
    expect(screen.queryByRole('region', { name: 'Lo importante ahora' })).toBeNull()
  })
})

describe('setup invitation preference', () => {
  const invite = {
    kind: 'address' as const,
    title: 'Agregá tu hogar',
    description: 'Guardá tu dirección para usarla en tus próximos pedidos.',
    action: { label: 'Agregar hogar', href: '/app/direcciones' },
    deferDays: 7
  }

  it('persists Ahora no for seven days and isolates the preference by profile', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-12T12:00:00.000Z').getTime())
    const { rerender } = render(<HomeSetupInvite invite={invite} preferenceScope="profile-a" />)
    await waitFor(() => expect(screen.getByText('Agregá tu hogar')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }))
    expect(screen.queryByText('Agregá tu hogar')).toBeNull()
    expect(localStorage.getItem('lysto:home-invite:profile-a:address')).toContain('deferUntil')

    rerender(<HomeSetupInvite invite={invite} preferenceScope="profile-a" />)
    await waitFor(() => expect(screen.queryByText('Agregá tu hogar')).toBeNull())

    rerender(<HomeSetupInvite invite={invite} preferenceScope="profile-b" />)
    await waitFor(() => expect(screen.getByText('Agregá tu hogar')).toBeTruthy())
  })

  it('ignores malformed local preference data', async () => {
    localStorage.setItem('lysto:home-invite:profile-a:address', 'invalid')
    render(<HomeSetupInvite invite={invite} preferenceScope="profile-a" />)
    await waitFor(() => expect(screen.getByText('Agregá tu hogar')).toBeTruthy())
  })
})
