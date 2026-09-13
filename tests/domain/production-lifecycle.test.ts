import { test, expect } from '../_lib/test.ts'
import { transitionJobStatus } from '../../lib/jobs/workflow.ts'
import { canTransition, requestTransitions } from '../../lib/domain/state-machine.ts'
import { completeCustomerWizard, createRequestFlow, approveConfirmedJobPayment, closeJobWithReport, confirmCompletedJob, transitionJob } from '../../lib/workflows/service-lifecycle.ts'
import { applyPaymentWebhook } from '../../lib/use-cases/payment-flow.ts'
import type { MarketplaceCheckoutStatus } from '../../lib/domain/types.ts'

test('producción: wrapper no confunde pago proyectado aprobado con checkout en revisión', () => {
  for (const canonicalPaymentStatus of ['review', 'charged_back', undefined] satisfies Array<MarketplaceCheckoutStatus | undefined>) {
    const context = { requestStatus: 'assigned' as const, jobStatus: 'confirmed' as const, paymentStatus: 'approved' as const, canonicalPaymentStatus, events: [] }
    expect(() => transitionJob(context, 'technician_on_way', 'professional')).toThrow()
  }
})

test('producción: wrapper decide visita por checkout aprobado aunque proyección esté atrasada', () => {
  const context = { requestStatus: 'assigned' as const, jobStatus: 'confirmed' as const, paymentStatus: 'pending' as const, canonicalPaymentStatus: 'approved' as const, events: [] }
  expect(transitionJob(context, 'technician_on_way', 'professional').jobStatus).toBe('technician_on_way')
})

test('producción: wrapper exige aceptación del adicional y transmite su confirmación', () => {
  const context = { requestStatus: 'assigned' as const, jobStatus: 'waiting_customer_approval' as const, canonicalPaymentStatus: 'approved' as const, events: [] }
  expect(() => transitionJob(context, 'in_progress', 'professional')).toThrow()
  const rejected = { ...context, customerApproved: false }
  expect(() => transitionJob(rejected, 'in_progress', 'professional')).toThrow()
  const accepted = { ...context, customerApproved: true }
  expect(transitionJob(accepted, 'in_progress', 'professional').jobStatus).toBe('in_progress')
})

test('producción: confirmar pago repetido conserva trabajo y no duplica eventos', () => {
  const context = { requestStatus: 'assigned' as const, jobStatus: 'confirmed' as const, canonicalPaymentStatus: 'pending' as const, paymentStatus: 'pending' as const, events: [] }
  const first = approveConfirmedJobPayment(context)
  const repeated = approveConfirmedJobPayment(first)
  expect(repeated.events).toEqual(first.events)
  expect(repeated.events.length).toBe(1)
  expect(repeated.jobStatus).toBe('confirmed')
  expect(repeated.requestStatus).toBe('assigned')
  expect(repeated.canonicalPaymentStatus).toBe('approved')
  const afterVisitStarted = { ...first, jobStatus: 'technician_on_way' as const }
  const replayAfterVisit = approveConfirmedJobPayment(afterVisitStarted)
  expect(replayAfterVisit.jobStatus).toBe('technician_on_way')
  expect(replayAfterVisit.events).toEqual(first.events)
})

test('producción: confirmación canónica admite proyección ya aprobada sin repetir efectos', () => {
  const context = { requestStatus: 'assigned' as const, jobStatus: 'confirmed' as const, canonicalPaymentStatus: 'pending' as const, paymentStatus: 'approved' as const, events: [] }
  const first = approveConfirmedJobPayment(context)
  expect(first.canonicalPaymentStatus).toBe('approved')
  expect(first.paymentStatus).toBe('approved')
  expect(first.events.length).toBe(1)
  expect(approveConfirmedJobPayment(first).events).toEqual(first.events)
})

test('producción: replay reconcilia proyección atrasada después de iniciar visita', () => {
  const first = approveConfirmedJobPayment({ requestStatus: 'assigned', jobStatus: 'confirmed', paymentStatus: 'pending', canonicalPaymentStatus: 'pending', events: [] })
  const startedWithStaleProjection = { ...first, jobStatus: 'technician_on_way' as const, paymentStatus: 'pending' as const }
  const reconciled = approveConfirmedJobPayment(startedWithStaleProjection)
  expect(reconciled.paymentStatus).toBe('approved')
  expect(reconciled.canonicalPaymentStatus).toBe('approved')
  expect(reconciled.jobStatus).toBe('technician_on_way')
  expect(reconciled.requestStatus).toBe('assigned')
  expect(reconciled.events).toEqual(startedWithStaleProjection.events)
  expect(approveConfirmedJobPayment(reconciled).events).toEqual(reconciled.events)
})

test('producción: técnico confirmado sin cobro no inicia visita', () => {
  expect(() => transitionJobStatus('confirmed', 'technician_on_way')).toThrow()
})

test('producción: aceptar presupuesto habilita asignación antes del cobro', () => {
  expect(canTransition(requestTransitions, 'price_selected', 'pending_assignment')).toBeTruthy()
  const context = completeCustomerWizard(createRequestFlow())
  expect(context.requestStatus).toBe('pending_assignment')
  expect(context.jobStatus).toBe('pending_assignment')
  expect(context.paymentStatus).toBe(undefined)
})

test('producción: un pago no crea un trabajo sin profesional confirmado', () => {
  expect(() => approveConfirmedJobPayment(completeCustomerWizard(createRequestFlow()))).toThrow()
})

test('producción: cierre técnico espera conformidad explícita y no exige reseña', () => {
  const context = closeJobWithReport({ requestStatus: 'assigned', jobStatus: 'in_progress', paymentStatus: 'approved', events: [] }, true)
  expect(context.jobStatus).toBe('completed_pending_customer_confirmation')
})

test('producción: webhook aprobado nunca crea otro trabajo', () => {
  const result = applyPaymentWebhook({ event: { id: 'e', type: 'payment', data: { id: 'p' }, status: 'approved' }, storedEvents: [], currentStatus: 'pending' })
  expect(result.shouldCreateJob).toBeFalsy()
})

test('producción: un reembolso parcial no se normaliza como pendiente', () => {
  const result = applyPaymentWebhook({ event: { id: 'e', type: 'payment', data: { id: 'p' }, status: 'partially_refunded' }, storedEvents: [], currentStatus: 'approved' })
  expect(result.toStatus).toBe('partially_refunded')
  expect(result.shouldNotifyAdmin).toBeTruthy()
})

test('producción: contracargo preserva estado canónico aun con proyección failed', () => {
  const result = applyPaymentWebhook({ event: { id: 'e', type: 'payment', data: { id: 'p' }, status: 'charged_back' }, storedEvents: [], currentStatus: 'approved' })
  expect(result.providerStatus).toBe('charged_back')
  expect(result.toStatus).toBe('failed')
  expect(result.shouldNotifyAdmin).toBeTruthy()
})

test('producción: revisión y reembolsos bloquean visita aunque existió cobro', () => {
  for (const status of ['review', 'charged_back', 'refunded', 'partially_refunded', 'pending']) {
    expect(() => transitionJobStatus('confirmed', 'technician_on_way', { canonicalPaymentStatus: status })).toThrow()
  }
  expect(transitionJobStatus('confirmed', 'technician_on_way', { canonicalPaymentStatus: 'approved' })).toBe('technician_on_way')
})

test('producción: conformidad completa el servicio sin reseña', () => {
  const closed = closeJobWithReport({ requestStatus: 'assigned', jobStatus: 'in_progress', paymentStatus: 'approved', events: [] }, true)
  expect(confirmCompletedJob(closed).jobStatus).toBe('completed')
  expect(() => transitionJobStatus('completed_pending_customer_confirmation', 'completed', { hasFinalReport: true })).toThrow()
})
