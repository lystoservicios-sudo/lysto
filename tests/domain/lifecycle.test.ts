import { test, expect } from '../_lib/test.ts'
import { assignProfessional, approvePaymentAndCreateJob, closeJobWithReport, completeCustomerWizard, completeFieldService, createRequestFlow, professionalAccepts, professionalRejects } from '../../lib/workflows/service-lifecycle.ts'

test('flujo cliente completo deja solicitud pendiente de pago', () => {
  const ctx = completeCustomerWizard(createRequestFlow())
  expect(ctx.requestStatus).toBe('pending_payment')
  expect(ctx.events.length).toBe(5)
})

test('pago aprobado crea job pendiente de asignacion', () => {
  const ctx = approvePaymentAndCreateJob(completeCustomerWizard(createRequestFlow()))
  expect(ctx.requestStatus).toBe('pending_assignment')
  expect(ctx.paymentStatus).toBe('approved')
  expect(ctx.jobStatus).toBe('pending_assignment')
})

test('admin asigna y profesional acepta', () => {
  const ctx = professionalAccepts(assignProfessional(approvePaymentAndCreateJob(completeCustomerWizard(createRequestFlow()))))
  expect(ctx.requestStatus).toBe('assigned')
  expect(ctx.jobStatus).toBe('confirmed')
})

test('profesional rechaza y vuelve a matching', () => {
  const ctx = professionalRejects(assignProfessional(approvePaymentAndCreateJob(completeCustomerWizard(createRequestFlow()))))
  expect(ctx.requestStatus).toBe('pending_assignment')
  expect(ctx.jobStatus).toBe('pending_assignment')
})

test('trabajo no puede cerrar sin informe final', () => {
  const active = completeFieldService(professionalAccepts(assignProfessional(approvePaymentAndCreateJob(completeCustomerWizard(createRequestFlow())))))
  expect(() => closeJobWithReport(active, false)).toThrow()
})

test('trabajo con informe final queda completado', () => {
  const active = completeFieldService(professionalAccepts(assignProfessional(approvePaymentAndCreateJob(completeCustomerWizard(createRequestFlow())))))
  const closed = closeJobWithReport(active, true)
  expect(closed.jobStatus).toBe('completed')
})
