import { test, expect } from '../_lib/test.ts'
import { prepareCustomerServiceRequest, assertCustomerRequestReadyForPayment } from '../../lib/use-cases/customer-request.ts'
import { createPaymentPreferenceDraft, applyPaymentWebhook } from '../../lib/use-cases/payment-flow.ts'
import { createAssignmentDecision } from '../../lib/use-cases/admin-operations.ts'
import { applyProfessionalJobAction, closeProfessionalJob, evaluateProfessionalOnboarding } from '../../lib/use-cases/professional-workflow.ts'
import { submitReviewCloseout } from '../../lib/use-cases/review-closeout.ts'
import type { ProfessionalCandidate } from '../../lib/matching/score-professionals.ts'

const validRequest = {
  customerId: 'cus_1',
  issue: 'no_enfria' as const,
  timeSince: 'days' as const,
  address: {
    street: 'Av. Corrientes',
    number: '1240',
    city: 'CABA',
    province: 'Buenos Aires',
    propertyType: 'apartment' as const,
    access: { hasElevator: true, hasParking: false }
  },
  schedule: { dateChoice: 'tomorrow' as const, timeWindow: '10:00 – 12:00' },
  selectedOption: 'priority' as const,
  media: { photosCount: 2, videosCount: 1 },
  zone: 'caba'
}

const candidates: ProfessionalCandidate[] = [
  { id: 'pro-1', name: 'Martín', status: 'approved', serviceSlugs: ['aire_acondicionado'], zones: ['caba'], available: true, hasLicense: true, toolsScore: 9, ratingAvg: 4.9, jobsCompleted: 40, activeJobs: 1, acceptanceRate: 0.95, distanceKm: 3, internalScore: 92 },
  { id: 'pro-2', name: 'Diego', status: 'approved', serviceSlugs: ['aire_acondicionado'], zones: ['caba'], available: true, hasLicense: true, toolsScore: 7, ratingAvg: 4.4, jobsCompleted: 11, activeJobs: 0, acceptanceRate: 0.8, distanceKm: 8, internalScore: 75 }
]

test('use case cliente prepara solicitud lista para pago', () => {
  const prepared = prepareCustomerServiceRequest(validRequest)
  expect(prepared.status).toBe('pending_payment')
  expect(prepared.selectedOption).toBe('priority')
  expect(prepared.paymentAmount).toBeGreaterThan(35000)
  expect(prepared.eventCodes.length).toBe(5)
  expect(prepared.nextAction).toBe('create_payment_preference')
})

test('use case cliente rechaza solicitud incompleta', () => {
  expect(() => prepareCustomerServiceRequest({ ...validRequest, address: { ...validRequest.address, street: '' } })).toThrow()
})

test('assertCustomerRequestReadyForPayment acepta draft completo', () => {
  assertCustomerRequestReadyForPayment(validRequest)
  expect(true).toBeTruthy()
})

test('payment preference crea idempotency key y split', () => {
  const prepared = prepareCustomerServiceRequest(validRequest)
  const payment = createPaymentPreferenceDraft({ requestId: prepared.id, customerId: 'cus_1', amount: prepared.paymentAmount, selectedOption: 'priority' })
  expect(payment.provider).toBe('mercadopago')
  expect(payment.status).toBe('pending')
  expect(payment.split.platformFee).toBeGreaterThan(0)
  expect(payment.idempotencyKey).toIncludeText(prepared.id)
})

test('payment webhook aprobado crea job y no notifica admin', () => {
  const applied = applyPaymentWebhook({ event: { id: 'evt-1', type: 'payment', data: { id: 'mp-1' }, status: 'approved' }, storedEvents: [], currentStatus: 'pending' })
  expect(applied.duplicate).toBeFalsy()
  expect(applied.toStatus).toBe('approved')
  expect(applied.shouldCreateJob).toBeTruthy()
  expect(applied.shouldNotifyAdmin).toBeFalsy()
})

test('payment webhook duplicado no vuelve a mutar pago', () => {
  const applied = applyPaymentWebhook({ event: { id: 'evt-1', type: 'payment', data: { id: 'mp-1' }, status: 'approved' }, storedEvents: [{ providerEventId: 'evt-1', paymentId: 'pay-1', status: 'approved' }], currentStatus: 'approved' })
  expect(applied.duplicate).toBeTruthy()
  expect(applied.shouldCreateJob).toBeFalsy()
})

test('admin asigna mejor candidato elegible', () => {
  const decision = createAssignmentDecision({ adminProfileId: 'admin-1', requestId: 'REQ-1', requestStatus: 'pending_assignment', serviceSlug: 'aire_acondicionado', zone: 'caba', candidates })
  expect(decision.professional.id).toBe('pro-1')
  expect(decision.nextRequestStatus).toBe('pending_professional_acceptance')
  expect(decision.auditEvent.action).toBe('job.assigned')
})

test('admin override solo funciona si profesional es elegible', () => {
  const decision = createAssignmentDecision({ adminProfileId: 'admin-1', requestId: 'REQ-1', requestStatus: 'pending_assignment', serviceSlug: 'aire_acondicionado', zone: 'caba', candidates, overrideProfessionalId: 'pro-2' })
  expect(decision.professional.id).toBe('pro-2')
  expect(decision.mode).toBe('admin_override')
})

test('admin no asigna solicitud impaga', () => {
  expect(() => createAssignmentDecision({ adminProfileId: 'admin-1', requestId: 'REQ-1', requestStatus: 'pending_payment', serviceSlug: 'aire_acondicionado', zone: 'caba', candidates })).toThrow()
})

test('onboarding listo pasa a under_review', () => {
  const readiness = evaluateProfessionalOnboarding({ professionalId: 'pro-1', currentStatus: 'form_submitted', hasDni: true, hasCuil: true, hasLicense: true, hasPhoto: true, hasMobility: true, toolScore: 8, zonesCount: 2, availabilitySlots: 5 })
  expect(readiness.readyForReview).toBeTruthy()
  expect(readiness.nextStatus).toBe('under_review')
})

test('onboarding under_review completo aprueba', () => {
  const readiness = evaluateProfessionalOnboarding({ professionalId: 'pro-1', currentStatus: 'under_review', hasDni: true, hasCuil: true, hasLicense: true, hasPhoto: true, hasMobility: true, toolScore: 8, zonesCount: 2, availabilitySlots: 5 })
  expect(readiness.readyForApproval).toBeTruthy()
  expect(readiness.nextStatus).toBe('approved')
})

test('onboarding incompleto lista faltantes', () => {
  const readiness = evaluateProfessionalOnboarding({ professionalId: 'pro-1', currentStatus: 'invited', hasDni: false, hasCuil: true, hasLicense: false, hasPhoto: true, hasMobility: false, toolScore: 3, zonesCount: 0, availabilitySlots: 0 })
  expect(readiness.readyForReview).toBeFalsy()
  expect(readiness.missing).toContain('dni')
  expect(readiness.missing).toContain('tools')
})

test('profesional acepta trabajo pendiente', () => {
  const action = applyProfessionalJobAction({ jobId: 'JOB-1', professionalId: 'pro-1', currentStatus: 'pending_professional_acceptance', action: 'accept' })
  expect(action.to).toBe('confirmed')
})

test('profesional no puede saltar directo de confirmado a llegado', () => {
  expect(() => applyProfessionalJobAction({ jobId: 'JOB-1', professionalId: 'pro-1', currentStatus: 'confirmed', action: 'arrived' })).toThrow()
})

test('cierre profesional genera garantía y requiere confirmación cliente', () => {
  const closeout = closeProfessionalJob({ jobId: 'JOB-1', equipmentId: 'EQ-1', realDiagnosis: 'Filtro y presión', workDone: 'Limpieza y control', resolutionStatus: 'resolved', maintenanceOption: 'deep_cleaning_6_months', photosAfterCount: 2 })
  expect(closeout.nextStatus).toBe('completed_pending_customer_confirmation')
  expect(closeout.requiresCustomerConfirmation).toBeTruthy()
  expect(String(closeout.warrantyUntil)).toIncludeText('2026-09')
})

test('review closeout actualiza rating y abre calidad si no resuelto', () => {
  const result = submitReviewCloseout({ jobId: 'JOB-1', customerId: 'cus-1', professionalId: 'pro-1', jobStatus: 'completed', alreadyReviewed: false, serviceRating: 2, professionalRating: 2, problemResolved: false, wouldHireAgain: false, previousRatingAvg: 4.7, previousJobsCompleted: 10, score: { serviceRating: 2, professionalRating: 2, resolved: false } })
  expect(result.openQualityCase).toBeTruthy()
  expect(result.nextActions).toContain('notify_admin_quality')
})
