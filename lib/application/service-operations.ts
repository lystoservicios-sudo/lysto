import type { JobStatus, PaymentStatus, ProfessionalStatus, RequestStatus, UrgencyLevel } from '../domain/types.ts'
import { generateDiagnosis } from '../diagnosis/rules.ts'
import { calculatePriceOptions } from '../pricing/calculate-price.ts'
import { rankProfessionals, type ProfessionalCandidate } from '../matching/score-professionals.ts'
import { normalizePaymentStatus, calculateMarketplaceSplit } from '../payments/idempotency.ts'
import { transitionJobStatus } from '../jobs/workflow.ts'
import { validateJobFinalReport, type JobFinalReportInput } from '../jobs/final-report.ts'
import { shouldOpenQualityCase, validateReview, type ReviewScore } from '../reviews/recalculate-rating.ts'
import { validateServiceRequestDraft, type ServiceRequestValidationInput } from '../service-request/validation.ts'

export type OperationEvent = {
  type: string
  actor: 'customer' | 'professional' | 'admin' | 'system' | 'webhook'
  message: string
}

export type OperationalCustomerDraft = ServiceRequestValidationInput & {
  issue: NonNullable<ServiceRequestValidationInput['issue']>
  timeSince: NonNullable<ServiceRequestValidationInput['timeSince']>
  address: {
    street: string
    number: string
    city: string
    province: string
    propertyType: NonNullable<NonNullable<ServiceRequestValidationInput['address']>['propertyType']>
    access: NonNullable<NonNullable<ServiceRequestValidationInput['address']>['access']>
  }
  schedule: NonNullable<ServiceRequestValidationInput['schedule']> & { dateChoice: NonNullable<NonNullable<ServiceRequestValidationInput['schedule']>['dateChoice']>; timeWindow: string }
}

export type LystoRequestRecord = {
  id: string
  customerId: string
  issue: OperationalCustomerDraft['issue']
  status: RequestStatus
  urgency: UrgencyLevel
  selectedOption: UrgencyLevel
  selectedAmount: number
  diagnosisSummary: string
  events: OperationEvent[]
}

export type LystoPaymentRecord = {
  id: string
  requestId: string
  status: PaymentStatus
  amount: number
  platformFee: number
  professionalAmount: number
  providerPaymentId?: string
  providerEventIds: string[]
}

export type LystoJobRecord = {
  id: string
  requestId: string
  customerId: string
  professionalId?: string
  status: JobStatus
  events: OperationEvent[]
  finalReportSubmitted: boolean
}

export type ProfessionalAssignmentResult = {
  job: LystoJobRecord
  request: LystoRequestRecord
  selectedProfessional: ProfessionalCandidate
  candidates: ProfessionalCandidate[]
}

function event(type: string, actor: OperationEvent['actor'], message: string): OperationEvent {
  return { type, actor, message }
}

function newId(prefix: string, seed: string): string {
  const safe = seed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'item'
  return `${prefix}_${safe}`
}

export function createOperationalRequest(input: { customerId: string; draft: OperationalCustomerDraft; selectedOption: UrgencyLevel }): { request: LystoRequestRecord; payment: LystoPaymentRecord } {
  const validation = validateServiceRequestDraft(input.draft)
  if (!validation.ok) throw new Error(`invalid_request:${validation.errors.join(',')}`)

  const diagnosis = generateDiagnosis({ issue: input.draft.issue, timeSince: input.draft.timeSince })
  const priceOptions = calculatePriceOptions({ issue: input.draft.issue, zone: 'caba', propertyType: input.draft.address.propertyType, access: input.draft.address.access })
  const selectedPrice = input.selectedOption === 'priority' ? priceOptions.priority : priceOptions.flexible
  const split = calculateMarketplaceSplit(selectedPrice.total, 0.18)
  const requestId = newId('req', `${input.customerId}_${input.draft.issue}_${input.selectedOption}`)

  return {
    request: {
      id: requestId,
      customerId: input.customerId,
      issue: input.draft.issue,
      status: 'pending_payment',
      urgency: input.selectedOption,
      selectedOption: input.selectedOption,
      selectedAmount: selectedPrice.total,
      diagnosisSummary: diagnosis.customerSummary,
      events: [event('request_created', 'customer', 'Solicitud creada y lista para pago')]
    },
    payment: {
      id: newId('pay', requestId),
      requestId,
      status: 'pending',
      amount: selectedPrice.total,
      platformFee: split.platformFee,
      professionalAmount: split.professionalAmount,
      providerEventIds: []
    }
  }
}

export function applyPaymentWebhook(input: { request: LystoRequestRecord; payment: LystoPaymentRecord; providerEventId: string; providerPaymentId: string; providerStatus: string }): { request: LystoRequestRecord; payment: LystoPaymentRecord; job?: LystoJobRecord; ignoredDuplicate: boolean } {
  if (input.payment.providerEventIds.includes(input.providerEventId)) {
    return { request: input.request, payment: input.payment, ignoredDuplicate: true }
  }

  const status = normalizePaymentStatus(input.providerStatus)
  const payment: LystoPaymentRecord = {
    ...input.payment,
    status,
    providerPaymentId: input.providerPaymentId,
    providerEventIds: [...input.payment.providerEventIds, input.providerEventId]
  }

  if (status !== 'approved') {
    return { request: input.request, payment, ignoredDuplicate: false }
  }

  const request: LystoRequestRecord = {
    ...input.request,
    status: 'pending_assignment',
    events: [...input.request.events, event('payment_approved', 'webhook', 'Pago aprobado por Mercado Pago')]
  }

  const job: LystoJobRecord = {
    id: newId('job', request.id),
    requestId: request.id,
    customerId: request.customerId,
    status: 'pending_assignment',
    events: [event('job_created', 'system', 'Trabajo creado y pendiente de asignación')],
    finalReportSubmitted: false
  }

  return { request, payment, job, ignoredDuplicate: false }
}

export function assignBestProfessional(input: { request: LystoRequestRecord; job: LystoJobRecord; professionals: ProfessionalCandidate[] }): ProfessionalAssignmentResult {
  if (input.request.status !== 'pending_assignment') throw new Error('request_not_pending_assignment')
  if (input.job.status !== 'pending_assignment') throw new Error('job_not_pending_assignment')
  const candidates = rankProfessionals(input.professionals, { serviceSlug: 'aire_acondicionado', zone: 'caba', requiredToolScore: input.request.issue === 'instalacion' ? 8 : 6, maxDistanceKm: input.request.urgency === 'priority' ? 20 : 35 })
  const selectedProfessional = candidates[0]
  if (!selectedProfessional) throw new Error('no_eligible_professional')

  return {
    request: {
      ...input.request,
      status: 'pending_professional_acceptance',
      events: [...input.request.events, event('professional_assigned', 'admin', `Profesional sugerido/asignado: ${selectedProfessional.name}`)]
    },
    job: {
      ...input.job,
      professionalId: selectedProfessional.id,
      status: 'pending_professional_acceptance',
      events: [...input.job.events, event('professional_assigned', 'admin', `Esperando aceptación de ${selectedProfessional.name}`)]
    },
    selectedProfessional,
    candidates
  }
}

export function professionalResponds(input: { request: LystoRequestRecord; job: LystoJobRecord; response: 'accepted' | 'rejected' }): { request: LystoRequestRecord; job: LystoJobRecord } {
  if (input.request.status !== 'pending_professional_acceptance' || input.job.status !== 'pending_professional_acceptance') throw new Error('not_waiting_professional')
  if (input.response === 'rejected') {
    return {
      request: { ...input.request, status: 'pending_assignment', events: [...input.request.events, event('professional_rejected', 'professional', 'Profesional rechazó la solicitud')] },
      job: { ...input.job, professionalId: undefined, status: 'pending_assignment', events: [...input.job.events, event('professional_rejected', 'professional', 'Volver a matching')] }
    }
  }
  return {
    request: { ...input.request, status: 'assigned', events: [...input.request.events, event('professional_accepted', 'professional', 'Profesional aceptó el trabajo')] },
    job: { ...input.job, status: 'confirmed', events: [...input.job.events, event('professional_accepted', 'professional', 'Trabajo confirmado')] }
  }
}

export function advanceJob(input: { job: LystoJobRecord; next: JobStatus; hasFinalReport?: boolean; customerApproved?: boolean }): LystoJobRecord {
  const next = transitionJobStatus(input.job.status, input.next, { hasFinalReport: input.hasFinalReport, customerApproved: input.customerApproved })
  return { ...input.job, status: next, events: [...input.job.events, event('job_status_changed', 'professional', `Estado actualizado a ${next}`)] }
}

export function closeOperationalJob(input: { job: LystoJobRecord; finalReport: JobFinalReportInput }): LystoJobRecord {
  const report = validateJobFinalReport(input.finalReport)
  if (!report.ok) throw new Error(`invalid_final_report:${report.errors.join(',')}`)
  const ready = input.job.status === 'in_progress' ? advanceJob({ job: input.job, next: 'completed_pending_customer_confirmation', hasFinalReport: true }) : input.job
  if (ready.status !== 'completed_pending_customer_confirmation') throw new Error('job_not_ready_to_complete')
  return { ...ready, status: 'completed', finalReportSubmitted: true, events: [...ready.events, event('job_completed', 'customer', 'Trabajo cerrado con informe técnico')] }
}

export function submitOperationalReview(input: { job: LystoJobRecord; review: ReviewScore & { comment?: string } }): { accepted: true; openQualityCase: boolean } {
  if (input.job.status !== 'completed') throw new Error('job_not_completed')
  validateReview(input.review)
  return { accepted: true, openQualityCase: shouldOpenQualityCase(input.review) }
}

export function canProfessionalReceiveWork(status: ProfessionalStatus, hasPaymentAccount: boolean): boolean {
  return status === 'approved' && hasPaymentAccount
}
