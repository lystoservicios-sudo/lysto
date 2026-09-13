import { test, expect } from '../_lib/test.ts'
import { assignProfessional, approveConfirmedJobPayment, closeJobWithReport, completeCustomerWizard, completeFieldService, createRequestFlow, professionalAccepts, professionalRejects } from '../../lib/workflows/service-lifecycle.ts'

test('flujo cliente completo acepta presupuesto y deja asignación pendiente', () => {
  const ctx = completeCustomerWizard(createRequestFlow())
  expect(ctx.requestStatus).toBe('pending_assignment')
  expect(ctx.events.length).toBe(5)
})

test('pago aprobado conserva trabajo y profesional confirmados', () => {
  const ctx = approveConfirmedJobPayment(professionalAccepts(assignProfessional(completeCustomerWizard(createRequestFlow()))))
  expect(ctx.requestStatus).toBe('assigned')
  expect(ctx.paymentStatus).toBe('approved')
  expect(ctx.jobStatus).toBe('confirmed')
})

test('admin asigna y profesional acepta', () => {
  const ctx = professionalAccepts(assignProfessional(completeCustomerWizard(createRequestFlow())))
  expect(ctx.requestStatus).toBe('assigned')
  expect(ctx.jobStatus).toBe('confirmed')
})

test('profesional rechaza y vuelve a matching', () => {
  const ctx = professionalRejects(assignProfessional(completeCustomerWizard(createRequestFlow())))
  expect(ctx.requestStatus).toBe('pending_assignment')
  expect(ctx.jobStatus).toBe('pending_assignment')
})

test('trabajo no puede cerrar sin informe final', () => {
  const active = completeFieldService(approveConfirmedJobPayment(professionalAccepts(assignProfessional(completeCustomerWizard(createRequestFlow())))))
  expect(() => closeJobWithReport(active, false)).toThrow()
})

test('trabajo con informe final espera conformidad', () => {
  const active = completeFieldService(approveConfirmedJobPayment(professionalAccepts(assignProfessional(completeCustomerWizard(createRequestFlow())))))
  const closed = closeJobWithReport(active, true)
  expect(closed.jobStatus).toBe('completed_pending_customer_confirmation')
})
