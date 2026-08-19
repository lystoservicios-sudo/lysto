import type { JobStatus, PaymentStatus, ProfessionalStatus, RequestStatus } from '../domain/types.ts'
import { assertTransition, jobTransitions, paymentTransitions, professionalTransitions, requestTransitions } from '../domain/state-machine.ts'

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
  paymentStatus?: PaymentStatus
  professionalStatus?: ProfessionalStatus
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
  assertTransition(jobTransitions, ctx.jobStatus, to, 'job')
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
  return transitionRequest(
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
    'pending_payment',
    'customer',
    'listo para pago'
  )
}

export function approvePaymentAndCreateJob(ctx: WorkContext): WorkContext {
  const withPayment = ctx.paymentStatus ? ctx : { ...ctx, paymentStatus: 'pending' as PaymentStatus }
  const paid = transitionPayment(withPayment, 'approved', 'webhook', 'Mercado Pago approved')
  const requestApproved = transitionRequest(paid, 'payment_approved', 'system', 'pago aprobado')
  const requestAssignment = transitionRequest(requestApproved, 'pending_assignment', 'system', 'crear cola de matching')
  return { ...requestAssignment, jobStatus: 'pending_assignment' }
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
  return transitionJob(
    transitionJob(ctx, 'completed_pending_customer_confirmation', 'professional', 'cierre técnico cargado'),
    'completed',
    'customer',
    'cliente confirmó o venció ventana de confirmación'
  )
}
