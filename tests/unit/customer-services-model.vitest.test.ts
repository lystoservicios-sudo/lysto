// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  buildCustomerQuoteSummary,
  buildCustomerServiceSummary,
  matchesCustomerServicesFilter,
  type CustomerServiceJobSource,
  type CustomerServiceQuoteSource,
  type CustomerServiceRequestSource
} from '@/features/customer/services-view-model'

const now = '2026-10-13T12:00:00.000Z'
const request: CustomerServiceRequestSource = {
  id: '10000000-0000-4000-8000-000000000001', status: 'assigned',
  createdAt: '2026-10-12T12:00:00.123456+00:00', issueLabel: 'Mantenimiento',
  equipmentName: 'Aire del living', address: 'Pavón 2012, CABA'
}
const job: CustomerServiceJobSource = {
  id: '20000000-0000-4000-8000-000000000001', requestId: request.id,
  status: 'confirmed', finalAmount: 40000, completedAt: null
}
const quote: CustomerServiceQuoteSource = {
  id: '30000000-0000-4000-8000-000000000001', requestId: request.id,
  status: 'accepted', scope: 'Limpieza y mantenimiento', total: 40000,
  createdAt: request.createdAt, expiresAt: '2026-10-14T12:00:00.000Z'
}
const visit = {
  startsAt: '2026-10-14T15:00:00.000Z', endsAt: '2026-10-14T17:00:00.000Z',
  timezone: 'America/Argentina/Buenos_Aires' as const, professionalName: 'Ana Pérez'
}
const paid = [{ jobId: job.id, extraId: null, status: 'approved' }]

describe('customer services projection', () => {
  it('describes an automatically assigned professional as confirmed, not personally accepted', () => {
    const summary = buildCustomerServiceSummary({
      request: { ...request, contractSource: 'automatic_customer_request' } as CustomerServiceRequestSource,
      job, checkouts: []
    }, now)
    expect(summary.description).toBe('El profesional está confirmado. Revisá el pago para continuar.')
  })

  it('closes an expired automatic request even when its job remains confirmed', () => {
    const summary = buildCustomerServiceSummary({
      request: { ...request, status: 'expired', contractSource: 'automatic_customer_request' } as CustomerServiceRequestSource,
      job, quote, checkouts: paid, visit
    }, now)
    expect(summary).toMatchObject({ phase: 'cancelled', statusLabel: 'Solicitud vencida', visit: null })
    expect(summary.action?.label).toBe('Consultar pago')
    expect(matchesCustomerServicesFilter(summary, 'scheduled')).toBe(false)
  })

  it('keeps legacy accepted jobs active when only the originating request is expired', () => {
    const summary = buildCustomerServiceSummary({ request: { ...request, status: 'expired' }, job, checkouts: paid, visit }, now)
    expect(summary.phase).toBe('scheduled')
  })

  it.each(['review', 'pending', 'in_process'])('keeps canonical %s visible after an automatic reservation expires', (status) => {
    const summary = buildCustomerServiceSummary({
      request: { ...request, status: 'expired', contractSource: 'automatic_customer_request' }, job, quote, visit,
      checkouts: [{ jobId: job.id, extraId: null, status }]
    }, now)
    expect(summary.statusLabel).toBe(status === 'review' ? 'Pago en revisión' : 'Pago en seguimiento')
    expect(summary).toMatchObject({ phase: 'cancelled', visit: null, amount: 40000 })
    expect(summary.action?.label).toBe('Consultar pago')
    expect(summary.description).toContain('venció')
    expect(summary.description).toContain('No vuelvas a pagar')
  })

  it('does not hide approved funds when the automatic visit reservation is expired', () => {
    const summary = buildCustomerServiceSummary({
      request: { ...request, status: 'expired', contractSource: 'automatic_customer_request' }, job, quote, checkouts: paid
    }, now)
    expect(summary.description).toContain('El pago está aprobado')
    expect(summary.action?.label).toBe('Consultar pago')
    expect(summary.visit).toBeNull()
  })

  it('uses the automatic visit address rather than a stale quote address', () => {
    const summary = buildCustomerServiceSummary({
      request: { ...request, address: 'Destino actual', contractSource: 'automatic_customer_request' } as CustomerServiceRequestSource,
      job, quote: { ...quote, address: 'Domicilio anterior' }
    }, now)
    expect(summary.address).toBe('Destino actual')
  })

  it('does not fill a missing automatic visit snapshot from its historical quote', () => {
    const summary = buildCustomerServiceSummary({
      request: { ...request, address: undefined, contractSource: 'automatic_customer_request' } as CustomerServiceRequestSource,
      job, quote: { ...quote, address: 'Domicilio anterior' }
    }, now)
    expect(summary.address).toBeUndefined()
  })

  it('uses one stable request identity when request, job and accepted quote are related', () => {
    const summary = buildCustomerServiceSummary({ request, job, quote, checkouts: paid, visit }, now)
    expect(summary).toMatchObject({
      id: `request:${request.id}`, requestId: request.id, jobId: job.id, quoteId: quote.id,
      title: 'Mantenimiento', subject: 'Aire del living', amount: 40000, phase: 'scheduled'
    })
    expect(summary.createdAt).toBe(request.createdAt)
    expect(summary.action?.href).toBe(`/app/trabajos/${job.id}`)
  })

  it('does not call an accepted professional a scheduled visit without an approved initial payment', () => {
    const summary = buildCustomerServiceSummary({ request, job, visit, checkouts: [] }, now)
    expect(summary.phase).toBe('attention')
    expect(summary.visit).toBeNull()
    expect(summary.statusLabel).toBe('Pago pendiente')
    expect(summary.action?.label).toBe('Ver pago')
  })

  it('does not use an approved additional checkout as an initial payment', () => {
    const summary = buildCustomerServiceSummary({
      request, job, visit, checkouts: [{ jobId: job.id, extraId: 'extra', status: 'approved' }]
    }, now)
    expect(summary.phase).toBe('attention')
    expect(summary.visit).toBeNull()
  })

  it('does not invent a schedule from createdAt when payment is approved', () => {
    const summary = buildCustomerServiceSummary({ request, job, checkouts: paid, visit: null }, now)
    expect(summary.phase).toBe('in_progress')
    expect(summary.visit).toBeNull()
    expect(summary.statusLabel).toBe('Pago confirmado')
  })

  it('does not suggest a new payment while the financial source failed', () => {
    const summary = buildCustomerServiceSummary({
      request, job, visit, checkouts: [], paymentState: 'error'
    }, now)
    expect(summary.statusLabel).toBe('Estado del pago por consultar')
    expect(summary.action?.label).toBe('Ver servicio')
    expect(summary.visit).toBeNull()
  })

  it.each(['review', 'pending', 'in_process', 'charged_back'])('uses a safe consultation action for %s payment', (status) => {
    const summary = buildCustomerServiceSummary({
      request, job, visit, checkouts: [{ jobId: job.id, extraId: null, status }]
    }, now)
    expect(summary.action?.label).toBe('Consultar pago')
    expect(summary.description).not.toContain('Volvé a pagar')
  })

  it.each(['review', 'refunded', 'partially_refunded', 'charged_back', 'in_process'])(
    'does not announce a confirmed visit when approved conflicts with %s', (status) => {
      const summary = buildCustomerServiceSummary({
        request, job, visit, checkouts: [...paid, { jobId: job.id, extraId: null, status }]
      }, now)
      expect(summary.statusLabel).toBe('Estado del pago por consultar')
      expect(summary.action?.label).toBe('Consultar pago')
      expect(summary.phase).not.toBe('scheduled')
      expect(summary.visit).toBeNull()
    }
  )

  it('keeps confirmation pending distinct from finished', () => {
    const summary = buildCustomerServiceSummary({
      request, job: { ...job, status: 'completed_pending_customer_confirmation' }
    }, now)
    expect(summary.phase).toBe('attention')
    expect(summary.action?.label).toBe('Revisar resultado')
  })

  it('projects completedAt only from the real completed job', () => {
    const summary = buildCustomerServiceSummary({
      request, job: { ...job, status: 'completed', completedAt: '2026-10-13T10:00:00Z' }
    }, now)
    expect(summary.phase).toBe('finished')
    expect(summary.completedAt).toBe('2026-10-13T10:00:00Z')
    expect(summary.action?.label).toBe('Ver resultado')
  })

  it.each(['cancelled_by_customer', 'cancelled_by_professional', 'cancelled_by_admin'] as const)(
    'keeps %s outside the finished filter', (status) => {
      const summary = buildCustomerServiceSummary({ request, job: { ...job, status } }, now)
      expect(summary.phase).toBe('cancelled')
      expect(matchesCustomerServicesFilter(summary, 'finished')).toBe(false)
      expect(matchesCustomerServicesFilter(summary, 'all')).toBe(true)
    }
  )

  it('does not expose a broken detail or claim a draft can be resumed without a job', () => {
    const summary = buildCustomerServiceSummary({ request: { ...request, status: 'draft' } }, now)
    expect(summary.action).toBeNull()
    expect(summary.jobId).toBeNull()
    expect(summary.description).toContain('recuperación')
  })

  it('keeps missing equipment, amount and address absent instead of filling invented values', () => {
    const summary = buildCustomerServiceSummary({
      request: { ...request, equipmentName: undefined, address: undefined, issueLabel: undefined }
    }, now)
    expect(summary.title).toBe('Servicio técnico')
    expect(summary.subject).toBeUndefined()
    expect(summary.address).toBeUndefined()
    expect(summary.amount).toBeNull()
  })

  it('uses the accepted address snapshot instead of a domicile edited after contracting', () => {
    const summary = buildCustomerServiceSummary({
      request: { ...request, address: 'Dirección editada' }, job,
      quote: { ...quote, address: 'Dirección acordada' }
    }, now)
    expect(summary.address).toBe('Dirección acordada')
  })

  it('keeps all pending decisions in all or in-progress, but respects focused history filters', () => {
    const summary = buildCustomerServiceSummary({
      request, job: { ...job, status: 'waiting_customer_approval' }
    }, now)
    for (const filter of ['all', 'in_progress'] as const) {
      expect(matchesCustomerServicesFilter(summary, filter)).toBe(true)
    }
    expect(matchesCustomerServicesFilter(summary, 'scheduled')).toBe(false)
    expect(matchesCustomerServicesFilter(summary, 'finished')).toBe(false)
  })
})

describe('pre-job customer quote projection', () => {
  it('links a ready unaccepted quote to its focused real route', () => {
    const summary = buildCustomerQuoteSummary({ ...quote, requestId: null, status: 'ready' }, now)
    expect(summary).toMatchObject({ id: `quote:${quote.id}`, requestId: null, jobId: null, phase: 'attention' })
    expect(summary?.action?.href).toBe(`/app/presupuestos?presupuesto=${quote.id}`)
  })

  it('does not claim a ready but expired quote is available for acceptance', () => {
    const summary = buildCustomerQuoteSummary({
      ...quote, requestId: null, status: 'ready', expiresAt: '2026-10-12T12:00:00Z'
    }, now)
    expect(summary?.statusLabel).toBe('Presupuesto vencido')
    expect(summary?.phase).toBe('in_progress')
    expect(summary?.action?.label).toBe('Ver presupuesto')
  })

  it('does not claim an invalid expiration is a ready quote', () => {
    const summary = buildCustomerQuoteSummary({
      ...quote, requestId: null, status: 'ready', expiresAt: 'invalid'
    }, now)
    expect(summary?.statusLabel).toBe('Presupuesto por consultar')
    expect(summary?.phase).toBe('in_progress')
    expect(summary?.action?.label).toBe('Ver presupuesto')
  })

  it.each(['superseded', 'accepted'])('does not produce a separate card for %s quote', (status) => {
    expect(buildCustomerQuoteSummary({ ...quote, requestId: null, status }, now)).toBeNull()
  })

  it('does not duplicate a quote already linked to a request', () => {
    expect(buildCustomerQuoteSummary({ ...quote, status: 'ready' }, now)).toBeNull()
  })
})
