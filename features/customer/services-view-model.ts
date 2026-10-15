import type { JobStatus, RequestStatus } from '@/lib/domain/types'
import { customerJobStatusLabels } from '@/lib/domain/job-status-labels'
import { isExpiredAutomaticRequest, type RequestVisitContext } from '@/lib/jobs/visit-address'

export type CustomerServicesFilter = 'all' | 'in_progress' | 'scheduled' | 'finished'
export type CustomerServiceVisit = {
  startsAt: string
  endsAt: string
  timezone: 'America/Argentina/Buenos_Aires'
  professionalName: string
}
export type CustomerServiceSummary = {
  id: string
  requestId: string | null
  jobId: string | null
  quoteId: string | null
  title: string
  subject?: string
  address?: string
  statusLabel: string
  phase: 'attention' | 'in_progress' | 'scheduled' | 'finished' | 'cancelled'
  action: { label: string; href: string } | null
  amount: number | null
  createdAt: string
  completedAt?: string
  visit: CustomerServiceVisit | null
  description?: string
}
export type CustomerServicesPage = {
  items: CustomerServiceSummary[]
  nextServiceCursor: string | null
  nextQuoteCursor: string | null
  unavailableSections: string[]
}
export type CustomerServiceRequestSource = RequestVisitContext & {
  id: string
  status: RequestStatus
  createdAt: string
  issueLabel?: string
  equipmentName?: string
  address?: string
}
export type CustomerServiceJobSource = {
  id: string
  requestId: string
  status: JobStatus
  finalAmount?: number | null
  completedAt?: string | null
}
export type CustomerServiceQuoteSource = {
  id: string
  requestId: string | null
  status: string
  scope: string
  total: number | null
  createdAt: string
  expiresAt: string
  address?: string
}
export type CustomerServiceCheckoutSource = {
  jobId: string
  extraId: string | null
  status: string
}
export type CustomerServiceProjectionSource = {
  request: CustomerServiceRequestSource
  job?: CustomerServiceJobSource
  quote?: CustomerServiceQuoteSource
  checkouts?: CustomerServiceCheckoutSource[]
  paymentState?: 'ready' | 'error'
  visit?: CustomerServiceVisit | null
}

/** Canonical initial checkout only; contradictory targets cannot establish payment. */
export function customerInitialPaymentState(
  checkouts: readonly CustomerServiceCheckoutSource[],
  jobId: string
): 'approved' | 'payable' | 'follow_up' | 'unknown' {
  const initial = checkouts.filter((checkout) => checkout.jobId === jobId && checkout.extraId === null)
  if (initial.length > 1) return 'unknown'
  const status = initial[0]?.status
  if (status === 'approved') return 'approved'
  if (!status || ['creating', 'ready', 'rejected', 'cancelled'].includes(status)) return 'payable'
  // in_process, pending, review, refunds, charged_back and unknown states require consultation.
  return 'follow_up'
}

export function buildCustomerServiceSummary(
  source: CustomerServiceProjectionSource,
  _now: string
): CustomerServiceSummary {
  // Kept aligned with the quote projector; accepted jobs do not expire with their quote.
  void _now
  const { request, job, quote } = source
  const summary: CustomerServiceSummary = {
    id: `request:${source.request.id}`, requestId: source.request.id,
    jobId: job?.id ?? null, quoteId: quote?.id ?? null,
    title: request.issueLabel ?? 'Servicio técnico', subject: request.equipmentName,
    address: request.contractSource === 'automatic_customer_request' ? request.address : quote?.address ?? request.address,
    statusLabel: 'Pedido en seguimiento',
    phase: 'in_progress', action: job ? { label: 'Ver servicio', href: `/app/trabajos/${job.id}` } : null,
    amount: job?.finalAmount ?? quote?.total ?? null, createdAt: request.createdAt, visit: null
  }
  if (isExpiredAutomaticRequest(request)) {
    summary.phase = 'cancelled'
    summary.statusLabel = 'Solicitud vencida'
    summary.description = 'La solicitud está cerrada. Podés consultar su información.'
    if (job) {
      const payment = customerInitialPaymentState(source.checkouts ?? [], job.id)
      if (source.paymentState === 'error' || payment === 'unknown') {
        summary.statusLabel = 'Estado del pago por consultar'
        summary.description = 'La reserva de la visita venció. No pudimos verificar el pago; consultá su estado antes de decidir. No vuelvas a pagar.'
        summary.action!.label = 'Consultar pago'
      } else if (payment === 'follow_up') {
        summary.statusLabel = source.checkouts?.some(checkout => checkout.jobId === job.id && checkout.extraId === null && checkout.status === 'review')
          ? 'Pago en revisión' : 'Pago en seguimiento'
        summary.description = 'La reserva de la visita venció y el pago sigue en seguimiento. Consultá la operación. No vuelvas a pagar mientras se verifica.'
        summary.action!.label = 'Consultar pago'
      } else if (payment === 'approved') {
        summary.description = 'El pago está aprobado, pero la reserva de la visita venció. Consultá la operación; no repitas el pago.'
        summary.action!.label = 'Consultar pago'
      }
    }
    return summary
  }
  if (!job) {
    if (request.status === 'cancelled' || request.status === 'expired') {
      summary.phase = 'cancelled'
      summary.statusLabel = request.status === 'expired' ? 'Solicitud vencida' : 'Solicitud cancelada'
      summary.description = 'La solicitud está cerrada.'
    } else if (['draft', 'diagnosis_completed', 'address_completed', 'schedule_completed', 'price_selected'].includes(request.status)) {
      summary.statusLabel = 'Borrador guardado'
      summary.description = 'La recuperación de este borrador todavía no está disponible.'
    } else {
      summary.description = 'El pedido está registrado. Su detalle estará disponible cuando exista un trabajo asociado.'
    }
    return summary
  }
  summary.statusLabel = customerJobStatusLabels[job.status]
  if (job.status.startsWith('cancelled')) {
    summary.phase = 'cancelled'
    summary.description = 'El servicio está cancelado; podés consultar su información.'
  } else if (job.status === 'completed') {
    summary.phase = 'finished'
    summary.completedAt = job.completedAt ?? undefined
    summary.action!.label = 'Ver resultado'
  } else if (job.status === 'completed_pending_customer_confirmation') {
    summary.phase = 'attention'
    summary.action!.label = 'Revisar resultado'
    summary.description = 'Revisá el informe antes de confirmar el resultado o informar un problema.'
  } else if (job.status === 'waiting_customer_approval') {
    summary.phase = 'attention'
    summary.action!.label = 'Revisar diagnóstico'
    summary.description = 'El diagnóstico o los adicionales requieren tu decisión.'
  } else if (job.status === 'confirmed') {
    const payment = customerInitialPaymentState(source.checkouts ?? [], job.id)
    if (source.paymentState === 'error') {
      summary.statusLabel = 'Estado del pago por consultar'
      summary.description = 'No pudimos consultar el pago. Revisá el estado antes de hacer otra operación.'
    } else if (payment === 'unknown') {
      summary.phase = 'attention'
      summary.statusLabel = 'Estado del pago por consultar'
      summary.action!.label = 'Consultar pago'
      summary.description = 'La información del pago requiere revisión. No vuelvas a pagar hasta que se confirme su estado.'
    } else if (payment !== 'approved') {
      summary.phase = 'attention'
      const consultation = payment === 'follow_up'
      summary.statusLabel = consultation ? 'Pago en seguimiento' : 'Pago pendiente'
      summary.action!.label = consultation ? 'Consultar pago' : 'Ver pago'
      summary.description = consultation
        ? 'Consultá el estado confirmado del pago. No vuelvas a pagar hasta que se confirme su estado.'
        : request.contractSource === 'automatic_customer_request'
          ? 'El profesional está confirmado. Revisá el pago para continuar.'
          : 'El profesional aceptó el servicio. Revisá el pago para continuar.'
    } else if (source.visit) {
      summary.phase = 'scheduled'
      summary.statusLabel = 'Visita confirmada'
      summary.visit = source.visit
      summary.action!.label = 'Ver visita'
    } else {
      summary.statusLabel = 'Pago confirmado'
      summary.description = 'Estamos confirmando la fecha de tu visita.'
    }
  }
  return summary
}

export function buildCustomerQuoteSummary(
  quote: CustomerServiceQuoteSource,
  now: string
): CustomerServiceSummary | null {
  if (quote.requestId || ['accepted', 'superseded'].includes(quote.status)) return null
  const expiresAt = Date.parse(quote.expiresAt)
  const currentTime = Date.parse(now)
  const validExpiry = Number.isFinite(expiresAt) && Number.isFinite(currentTime)
  const expired = validExpiry && expiresAt <= currentTime
  const ready = validExpiry && !expired && quote.status === 'ready'
  const closed = ['cancelled', 'rejected'].includes(quote.status)
  return {
    id: `quote:${quote.id}`, requestId: null, jobId: null, quoteId: quote.id,
    title: quote.scope, address: quote.address,
    statusLabel: closed ? 'Presupuesto cerrado' : !validExpiry ? 'Presupuesto por consultar'
      : expired ? 'Presupuesto vencido' : ready ? 'Presupuesto listo' : 'Presupuesto en revisión',
    phase: closed ? 'cancelled' : ready ? 'attention' : 'in_progress',
    action: { label: ready ? 'Revisar presupuesto' : 'Ver presupuesto', href: `/app/presupuestos?presupuesto=${quote.id}` },
    amount: quote.total, createdAt: quote.createdAt, visit: null,
    description: !validExpiry ? 'No pudimos verificar la vigencia. Consultá el presupuesto antes de decidir.'
      : expired ? 'Necesita revisión antes de poder aceptarlo.' : ready
      ? 'Revisá el alcance y el importe. Aceptar no implica pagar.'
      : 'Por ahora no necesitás hacer nada.'
  }
}

export function matchesCustomerServicesFilter(
  item: CustomerServiceSummary,
  filter: CustomerServicesFilter
): boolean {
  return filter === 'all' || item.phase === filter || (filter === 'in_progress' && item.phase === 'attention')
}
