import type { JobStatus, MarketplaceCheckoutStatus, PaymentStatus, ProfessionalStatus, RequestStatus } from '../domain/types.ts'
import { assertTransition, paymentTransitions, professionalTransitions, requestTransitions } from '../domain/state-machine.ts'
import { transitionJobStatus } from '../jobs/workflow.ts'

export type LifecycleEvent = {
  entity: 'request' | 'job' | 'payment' | 'professional'
  from: string
  to: string
  actor: 'customer' | 'professional' | 'admin' | 'system' | 'webhook'
  note?: string
  createdAt: string
}

export type WorkContext = {
  requestStatus: RequestStatus
  jobStatus?: JobStatus
  /** Legacy payments projection; never used to authorize a visit. */
  paymentStatus?: PaymentStatus
  /** Authoritative marketplace_checkouts status, independently supplied. */
  canonicalPaymentStatus?: MarketplaceCheckoutStatus
  professionalStatus?: ProfessionalStatus
  hasFinalReport?: boolean
  /** Explicit persisted decision on the current extra, independent of payment. */
  customerApproved?: boolean
  customerConfirmed?: boolean
  events: LifecycleEvent[]
}

function event(entity: LifecycleEvent['entity'], from: string, to: string, actor: LifecycleEvent['actor'], note?: string): LifecycleEvent {
  return { entity, from, to, actor, note, createdAt: new Date(0).toISOString() }
}

export function transitionRequest(ctx: WorkContext, to: RequestStatus, actor: LifecycleEvent['actor'], note?: string): WorkContext {
  assertTransition(requestTransitions, ctx.requestStatus, to, 'request')
  return { ...ctx, requestStatus: to, events: [...ctx.events, event('request', ctx.requestStatus, to, actor, note)] }
}

export function transitionJob(ctx: WorkContext, to: JobStatus, actor: LifecycleEvent['actor'], note?: string): WorkContext {
  if (!ctx.jobStatus) throw new Error('Job is required')
  transitionJobStatus(ctx.jobStatus, to, { canonicalPaymentStatus: ctx.canonicalPaymentStatus, customerApproved: ctx.customerApproved, hasFinalReport: ctx.hasFinalReport, customerConfirmed: actor === 'customer' && ctx.customerConfirmed })
  return { ...ctx, jobStatus: to, events: [...ctx.events, event('job', ctx.jobStatus, to, actor, note)] }
}

export function transitionPayment(ctx: WorkContext, to: PaymentStatus, actor: LifecycleEvent['actor'], note?: string): WorkContext {
  if (!ctx.paymentStatus) throw new Error('Payment is required')
  assertTransition(paymentTransitions, ctx.paymentStatus, to, 'payment')
  return { ...ctx, paymentStatus: to, events: [...ctx.events, event('payment', ctx.paymentStatus, to, actor, note)] }
}

export function transitionProfessional(ctx: WorkContext, to: ProfessionalStatus, actor: LifecycleEvent['actor'], note?: string): WorkContext {
  if (!ctx.professionalStatus) throw new Error('Professional is required')
  assertTransition(professionalTransitions, ctx.professionalStatus, to, 'professional')
  return { ...ctx, professionalStatus: to, events: [...ctx.events, event('professional', ctx.professionalStatus, to, actor, note)] }
}

export function createRequestFlow(): WorkContext {
  return { requestStatus: 'draft', events: [] }
}

export function completeCustomerWizard(ctx: WorkContext): WorkContext {
  const accepted = transitionRequest(
    transitionRequest(
      transitionRequest(
        transitionRequest(
          transitionRequest(ctx, 'diagnosis_completed', 'customer', 'diagnóstico preliminar generado'),
          'address_completed',
          'customer',
          'dirección confirmada'
        ),
        'schedule_completed',
        'customer',
        'horario seleccionado'
      ),
      'price_selected',
      'customer',
      'presupuesto seleccionado'
    ),
    'pending_assignment',
    'customer',
    'presupuesto aceptado; trabajo pendiente de asignación'
  )
  return { ...accepted, jobStatus: 'pending_assignment' }
}

export function approveConfirmedJobPayment(ctx: WorkContext): WorkContext {
  // Replayed observations cannot append events or rewind an already progressing job.
  if (ctx.canonicalPaymentStatus === 'approved' && ctx.paymentStatus === 'approved') return ctx
  if (ctx.canonicalPaymentStatus !== 'approved' && (ctx.jobStatus !== 'confirmed' || ctx.requestStatus !== 'assigned')) throw new Error('Confirmed professional and accepted quote required before checkout')
  const projectedStatus = ctx.paymentStatus ?? 'pending'
  if (projectedStatus !== 'approved') assertTransition(paymentTransitions, projectedStatus, 'approved', 'payment')
  // Model one canonical observation; an already updated projection is not a new event.
  return {
    ...ctx,
    paymentStatus: 'approved',
    canonicalPaymentStatus: 'approved',
    events: ctx.canonicalPaymentStatus === 'approved' ? ctx.events : [...ctx.events, event('payment', ctx.canonicalPaymentStatus ?? 'pending', 'approved', 'webhook', 'Mercado Pago approved; trabajo existente')]
  }
}

export function assignProfessional(ctx: WorkContext): WorkContext {
  const requestWaiting = transitionRequest(ctx, 'pending_professional_acceptance', 'admin', 'profesional asignado')
  return transitionJob(requestWaiting, 'pending_professional_acceptance', 'admin', 'esperando aceptación profesional')
}

export function professionalAccepts(ctx: WorkContext): WorkContext {
  const requestAssigned = transitionRequest(ctx, 'assigned', 'professional', 'profesional aceptó')
  return transitionJob(requestAssigned, 'confirmed', 'professional', 'trabajo confirmado')
}

export function professionalRejects(ctx: WorkContext): WorkContext {
  const requestBack = transitionRequest(ctx, 'pending_assignment', 'professional', 'profesional rechazó')
  return transitionJob(requestBack, 'pending_assignment', 'professional', 'volver a matching')
}

export function completeFieldService(ctx: WorkContext): WorkContext {
  return transitionJob(
    transitionJob(
      transitionJob(
        transitionJob(ctx, 'technician_on_way', 'professional', 'sale al domicilio'),
        'arrived',
        'professional',
        'llega al domicilio'
      ),
      'onsite_diagnosis',
      'professional',
      'inicia diagnóstico presencial'
    ),
    'in_progress',
    'professional',
    'cliente aprobó o no requiere adicional'
  )
}

export function closeJobWithReport(ctx: WorkContext, hasFinalReport: boolean): WorkContext {
  if (!hasFinalReport) throw new Error('Final technical report is required before closing')
  return transitionJob({ ...ctx, hasFinalReport }, 'completed_pending_customer_confirmation', 'professional', 'cierre técnico cargado')
}

export function confirmCompletedJob(ctx: WorkContext): WorkContext {
  return transitionJob({ ...ctx, customerConfirmed: true }, 'completed', 'customer', 'conformidad explícita del cliente')
}
