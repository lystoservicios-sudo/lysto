// @vitest-environment node
// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  buildCustomerHomeViewModel,
  type CustomerHomeSource,
  type HomeDataset
} from '@/features/customer/home-view-model'

const now = '2026-10-12T15:00:00.000Z'
const ready = <T>(items: T[]): HomeDataset<T> => ({ state: 'ready', items })
const count = (value: number): HomeDataset<number> => ({ state: 'ready', items: [value] })

function source(overrides: Partial<CustomerHomeSource> = {}): CustomerHomeSource {
  return {
    preferenceScope: 'profile-1',
    now,
    quotes: ready([]),
    requests: ready([]),
    jobs: ready([]),
    checkouts: ready([]),
    addresses: count(1),
    equipment: count(1),
    maintenance: ready([]),
    supportCases: ready([]),
    ...overrides
  }
}

describe('customer home selector', () => {
  const autoJob = { id: 'auto-job', requestId: 'auto-request', status: 'confirmed' as const, issueLabel: 'Pierde agua',
    nextStep: 'Consultar servicio', createdAt: now, visit: null, visitState: 'ready' as const,
    contractSource: 'automatic_customer_request', requestStatus: 'pending_payment' as const }

  it('does not attribute automatic confirmation to an individual technician decision', () => {
    const model = buildCustomerHomeViewModel(source({ jobs: ready([autoJob]) }))
    expect(model.activity[0].title).toBe('El profesional está confirmado')
  })

  it('omits expired automatic contracts from the active and payable activity', () => {
    const model = buildCustomerHomeViewModel(source({ jobs: ready([{ ...autoJob, requestStatus: 'expired' }]) }))
    expect(model.activity).toEqual([])
  })

  it.each(['review', 'pending', 'in_process', 'approved'])('keeps canonical %s consultable for an expired automatic reservation', (status) => {
    const model = buildCustomerHomeViewModel(source({ jobs: ready([{ ...autoJob, requestStatus: 'expired' }]),
      checkouts: ready([{jobId:autoJob.id,extraId:null,status}]) }))
    expect(model.activity).toHaveLength(1)
    expect(model.activity[0].action?.label).toBe('Consultar pago')
    expect(model.activity[0].description).toContain('venció')
    expect(model.activity[0].kind).not.toBe('visit')
    expect(model.activity[0].eyebrow).not.toBe('Pago habilitado')
  })

  it.each(['review', 'pending', 'in_process', 'charged_back'])(
    'offers consultation rather than a new payment for canonical %s', (status) => {
      const model = buildCustomerHomeViewModel(source({ jobs: ready([autoJob]), checkouts: ready([{ jobId: autoJob.id, extraId: null, status }]) }))
      expect(model.activity[0].action?.label).toBe('Consultar pago')
      expect(model.activity[0].eyebrow).not.toBe('Pago habilitado')
    }
  )

  it('does not announce a visit with contradictory approved and review checkouts', () => {
    const model = buildCustomerHomeViewModel(source({ jobs: ready([{ ...autoJob, visit: {
      startsAt: '2026-10-15T15:00:00Z', endsAt: '2026-10-15T17:00:00Z', timezone: 'America/Argentina/Buenos_Aires', professionalName: 'Ana'
    } }]), checkouts: ready([{ jobId: autoJob.id, extraId: null, status: 'approved' }, { jobId: autoJob.id, extraId: null, status: 'review' }]) }))
    expect(model.activity[0].kind).not.toBe('visit')
    expect(model.activity[0].action?.label).toBe('Consultar pago')
  })

  it('offers the service and one address invitation to a new customer', () => {
    const model = buildCustomerHomeViewModel(
      source({ addresses: count(0), equipment: count(0) })
    )

    expect(model.service.href).toBe('/app/solicitar/aire-acondicionado')
    expect(model.setupInvite?.kind).toBe('address')
  })

  it('invites a customer with an address and no equipment to add equipment', () => {
    const model = buildCustomerHomeViewModel(source({ equipment: count(0) }))
    expect(model.setupInvite?.kind).toBe('equipment')
  })

  it('recognizes a persisted draft but does not invent a resume action', () => {
    const model = buildCustomerHomeViewModel(
      source({
        requests: ready([
          {
            id: 'request-draft',
            status: 'draft',
            issueLabel: 'Mantenimiento',
            nextStep: 'Continuar la solicitud',
            createdAt: '2026-10-10T12:00:00.000Z'
          }
        ]),
        equipment: count(0)
      })
    )

    expect(model.activity).toEqual([
      expect.objectContaining({ kind: 'draft', action: null, disabledReason: expect.any(String) })
    ])
    expect(model.setupInvite).toBeNull()
  })

  it('treats a quote under review as progress, not as a draft or payment', () => {
    const model = buildCustomerHomeViewModel(
      source({
        quotes: ready([
          {
            id: 'quote-review',
            requestId: null,
            status: 'needs_review',
            scope: 'Mantenimiento',
            total: 25000,
            expiresAt: '2026-10-20T12:00:00.000Z',
            createdAt: '2026-10-11T12:00:00.000Z'
          }
        ])
      })
    )

    expect(model.activity[0]).toMatchObject({
      kind: 'progress',
      action: { label: 'Ver presupuesto', href: '/app/presupuestos#presupuesto-quote-review' }
    })
  })

  it('prioritizes a ready quote as a customer decision', () => {
    const model = buildCustomerHomeViewModel(
      source({
        quotes: ready([
          {
            id: 'quote-ready',
            requestId: null,
            status: 'ready',
            scope: 'Reparación',
            total: 42000,
            expiresAt: '2026-10-20T12:00:00.000Z',
            createdAt: '2026-10-11T12:00:00.000Z'
          }
        ])
      })
    )

    expect(model.activity[0]).toMatchObject({
      kind: 'decision',
      action: { label: 'Revisar presupuesto', href: '/app/presupuestos#presupuesto-quote-ready' }
    })
  })

  it('shows only a confirmed visit with its real date, window and professional', () => {
    const model = buildCustomerHomeViewModel(
      source({
        jobs: ready([
          {
            id: 'job-visit',
            requestId: 'request-visit',
            status: 'confirmed',
            issueLabel: 'Mantenimiento',
            equipmentName: 'Aire del living',
            nextStep: 'Esperar la visita programada',
            createdAt: '2026-10-10T12:00:00.000Z',
            visit: {
              startsAt: '2026-10-15T16:00:00.000Z',
              endsAt: '2026-10-15T18:00:00.000Z',
              timezone: 'America/Argentina/Buenos_Aires',
              professionalName: 'Lucía Fernández'
            },
            visitState: 'ready'
          }
        ]),
        checkouts: ready([{ jobId: 'job-visit', extraId: null, status: 'approved' }])
      })
    )

    expect(model.activity[0]).toMatchObject({
      kind: 'visit',
      professionalName: 'Lucía Fernández',
      startsAt: '2026-10-15T16:00:00.000Z',
      action: { label: 'Ver seguimiento', href: '/app/trabajos/job-visit' }
    })
  })

  it('offers payment only after professional acceptance and before approval', () => {
    const model = buildCustomerHomeViewModel(
      source({
        jobs: ready([
          {
            id: 'job-payment',
            requestId: 'request-payment',
            status: 'confirmed',
            issueLabel: 'Reparación',
            nextStep: 'Esperar la visita programada',
            createdAt: '2026-10-10T12:00:00.000Z',
            visit: null,
            visitState: 'ready'
          }
        ])
      })
    )

    expect(model.activity[0]).toMatchObject({
      kind: 'decision',
      action: { label: 'Ver pago', href: '/app/trabajos/job-payment' }
    })
  })

  it('deduplicates a linked quote, request and job by their real relationship', () => {
    const model = buildCustomerHomeViewModel(
      source({
        quotes: ready([
          {
            id: 'quote-linked', requestId: 'request-linked', status: 'accepted', scope: 'Reparación',
            total: 42000, expiresAt: '2026-10-20T12:00:00.000Z', createdAt: '2026-10-09T12:00:00.000Z'
          }
        ]),
        requests: ready([
          {
            id: 'request-linked', status: 'assigned', issueLabel: 'Reparación',
            nextStep: 'Seguir el trabajo confirmado', createdAt: '2026-10-09T12:00:00.000Z'
          }
        ]),
        jobs: ready([
          {
            id: 'job-linked', requestId: 'request-linked', status: 'waiting_customer_approval',
            issueLabel: 'Reparación', nextStep: 'Revisar y decidir el presupuesto adicional',
            createdAt: '2026-10-10T12:00:00.000Z', visit: null, visitState: 'ready'
          }
        ])
      })
    )

    expect(model.activity).toHaveLength(1)
    expect(model.activity[0]).toMatchObject({ kind: 'decision', contractKey: 'request:request-linked' })
  })

  it('preserves decisions from different services', () => {
    const jobs = ['one', 'two'].map((id) => ({
      id: `job-${id}`,
      requestId: `request-${id}`,
      status: 'waiting_customer_approval' as const,
      issueLabel: 'Reparación',
      nextStep: 'Revisar adicional',
      createdAt: '2026-10-10T12:00:00.000Z',
      visit: null,
      visitState: 'ready' as const
    }))
    const model = buildCustomerHomeViewModel(source({ jobs: ready(jobs) }))
    expect(model.activity.filter((item) => item.kind === 'decision')).toHaveLength(2)
  })

  it('keeps a quiet account brief without filler activity', () => {
    const model = buildCustomerHomeViewModel(source())
    expect(model.activity).toEqual([])
    expect(model.setupInvite).toBeNull()
    expect(model.orderHistory.map((item) => item.href)).toEqual([
      '/app/presupuestos', '/app/solicitudes', '/app/trabajos'
    ])
  })

  it('removes the setup invitation as soon as the corresponding record exists', () => {
    expect(buildCustomerHomeViewModel(source({ equipment: count(0) })).setupInvite).not.toBeNull()
    expect(buildCustomerHomeViewModel(source({ equipment: count(1) })).setupInvite).toBeNull()
  })

  it('never infers an invitation from a failed query', () => {
    const model = buildCustomerHomeViewModel(
      source({ addresses: { state: 'error', label: 'domicilios' }, equipment: count(0) })
    )
    expect(model.setupInvite).toBeNull()
    expect(model.unavailableSections).toContain('domicilios')
  })

  it('redirects blocked maintenance to its real open case', () => {
    const model = buildCustomerHomeViewModel(
      source({
        maintenance: ready([
          {
            id: 'maintenance-1', equipmentName: 'Aire del dormitorio',
            recommendation: 'Limpieza profunda', dueAt: '2026-10-05', status: 'suppressed_by_case',
            sourceJobId: 'job-warranty'
          }
        ]),
        supportCases: ready([
          {
            id: 'case-1', jobId: 'job-warranty', status: 'in_review', category: 'warranty',
            summary: 'Estamos revisando la cobertura.', updatedAt: '2026-10-11T12:00:00.000Z'
          }
        ])
      })
    )

    expect(model.activity.find((item) => item.kind === 'maintenance')).toMatchObject({
      kind: 'maintenance',
      action: { label: 'Ver caso', href: '/app/garantias' }
    })
  })

  it('promotes a support case that is waiting for the customer', () => {
    const model = buildCustomerHomeViewModel(
      source({
        supportCases: ready([
          {
            id: 'case-waiting', jobId: null, status: 'waiting_customer', category: 'quality',
            summary: 'Necesitamos una respuesta para continuar.', updatedAt: '2026-10-11T12:00:00.000Z'
          }
        ])
      })
    )
    expect(model.activity[0]).toMatchObject({ kind: 'decision', action: { label: 'Ver caso', href: '/app/garantias' } })
  })

  it('summarizes an owned equipment record without inventing care dates', () => {
    const model = buildCustomerHomeViewModel(source({
      equipmentDetails: ready([{ id: 'equipment-living', name: 'Aire del living' }])
    }))

    expect(model.household).toEqual({
      id: 'equipment-living',
      title: 'Aire del living',
      description: 'Datos e historial del equipo',
      action: { label: 'Ver equipo', href: '/app/equipos/equipment-living' }
    })
  })

  it('summarizes the earliest active care recommendation with a real equipment link', () => {
    const model = buildCustomerHomeViewModel(source({
      equipmentDetails: ready([{ id: 'equipment-living', name: 'Aire del living' }]),
      maintenance: ready([
        { id: 'later', equipmentId: 'equipment-living', equipmentName: 'Aire del living', recommendation: 'deep_cleaning_annual', dueAt: '2027-02-12', status: 'planned', sourceJobId: null },
        { id: 'soon', equipmentId: 'equipment-bedroom', equipmentName: 'Aire del dormitorio', recommendation: 'filters_60_days', dueAt: '2026-10-20', status: 'deferred', sourceJobId: null },
        { id: 'old', equipmentId: 'equipment-living', equipmentName: 'Aire del living', recommendation: 'electrical_review', dueAt: '2026-09-01', status: 'completed', sourceJobId: null }
      ])
    }))

    expect(model.household).toEqual({
      id: 'equipment-bedroom',
      title: 'Aire del dormitorio',
      description: 'Limpieza de filtros en 60 días',
      maintenanceId: 'soon',
      action: { label: 'Ver mantenimiento', href: '/app/mantenimientos' }
    })
  })

  it('keeps a care recommendation blocked by an open case out of the household summary', () => {
    const model = buildCustomerHomeViewModel(source({
      equipmentDetails: ready([{ id: 'equipment-living', name: 'Aire del living' }]),
      maintenance: ready([{ id: 'care', equipmentId: 'equipment-living', equipmentName: 'Aire del living', recommendation: 'electrical_review', dueAt: '2026-10-20', status: 'planned', sourceJobId: 'job-living' }]),
      supportCases: ready([{ id: 'case', jobId: 'job-living', status: 'in_review', category: 'warranty', summary: 'Estamos revisando el caso.', updatedAt: now }])
    }))

    expect(model.household).toMatchObject({
      description: 'Datos e historial del equipo',
      action: { href: '/app/equipos/equipment-living' }
    })
    expect(model.household?.maintenanceId).toBeUndefined()
  })

  it('links unresolved care to its original service instead of requesting another service', () => {
    const model = buildCustomerHomeViewModel(source({
      maintenance: ready([{ id: 'continuity', equipmentId: 'equipment-living', equipmentName: 'Aire del living', recommendation: 'pending_part_replacement', dueAt: null, status: 'planned', sourceJobId: 'job-original' }])
    }))

    expect(model.household).toMatchObject({
      maintenanceId: 'continuity',
      description: 'Cambio de repuesto pendiente',
      action: { label: 'Ver seguimiento', href: '/app/trabajos/job-original' }
    })
  })

  it('shows only a completed service with its actual completion date', () => {
    const model = buildCustomerHomeViewModel(source({
      completedJobs: ready([
        { id: 'pending', requestId: 'r-pending', status: 'completed_pending_customer_confirmation', issueLabel: 'Reparación', nextStep: '', createdAt: now, completedAt: now, visit: null, visitState: 'ready' },
        { id: 'cancelled', requestId: 'r-cancelled', status: 'cancelled_by_customer', issueLabel: 'Instalación', nextStep: '', createdAt: now, completedAt: now, visit: null, visitState: 'ready' },
        { id: 'completed', requestId: 'r-completed', status: 'completed', issueLabel: 'Mantenimiento', equipmentId: 'equipment-living', nextStep: '', createdAt: '2026-10-01', completedAt: '2026-10-10T18:00:00.000Z', visit: null, visitState: 'ready' }
      ]),
      equipmentDetails: ready([{ id: 'equipment-living', name: 'Aire del living' }])
    }))

    expect(model.lastService).toEqual({
      id: 'completed', title: 'Mantenimiento', equipmentName: 'Aire del living',
      completedAt: '2026-10-10T18:00:00.000Z',
      action: { label: 'Ver servicio', href: '/app/trabajos/completed' }
    })
  })

  it('does not replace a missing completion date with the scheduled date', () => {
    const model = buildCustomerHomeViewModel(source({
      completedJobs: ready([{ id: 'completed', requestId: 'request', status: 'completed', issueLabel: 'Reparación', nextStep: '', createdAt: '2026-10-01', visit: null, visitState: 'ready' }])
    }))
    expect(model.lastService?.completedAt).toBeUndefined()
  })

  it('keeps summaries empty when the optional real datasets are absent', () => {
    const model = buildCustomerHomeViewModel(source())
    expect(model.household).toBeNull()
    expect(model.lastService).toBeNull()
  })

  it('preserves customer decisions when either new summary source is unavailable', () => {
    const model = buildCustomerHomeViewModel(source({
      equipmentDetails: { state: 'error', label: 'equipos' },
      completedJobs: { state: 'error', label: 'historial' },
      quotes: ready([{ id: 'decision', requestId: null, status: 'ready', scope: 'Reparación', total: 40000, expiresAt: '2026-10-20', createdAt: now }])
    }))
    expect(model.activity[0].kind).toBe('decision')
    expect(model.unavailableSections).toContain('historial')
    expect(model.household).toBeNull()
    expect(model.lastService).toBeNull()
  })
})
