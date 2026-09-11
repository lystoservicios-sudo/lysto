import { decideProfessionalAssignment } from '../../lib/admin/assignment.ts'
import { validateAuditEvent, type AuditEventDraft } from '../../lib/admin/audit.ts'
import { calculateDueDate, shouldCreateMaintenanceReminder } from '../../lib/customer/maintenance-plan.ts'
import type { JobStatus } from '../../lib/domain/types.ts'
import { validateEquipmentRegistration, type EquipmentRegistrationInput } from '../../lib/equipment/equipment-registry.ts'
import { applyProfessionalJobAction, closeProfessionalJob, type FinalCloseoutCommand } from '../../lib/use-cases/professional-workflow.ts'
import { buildPublicReceipt } from '../../lib/qr/public-receipt.ts'
import { submitReviewCloseout, type ReviewCloseoutInput } from '../../lib/use-cases/review-closeout.ts'
import { planJobStatusNotification, planPaymentNotification, planRequestStatusNotification } from '../../lib/notifications/events.ts'
import { prepareCustomerServiceRequest, type CustomerRequestCommand } from '../../lib/use-cases/customer-request.ts'
import { applyPaymentWebhook, createPaymentPreferenceDraft } from '../../lib/use-cases/payment-flow.ts'
import type { ProfessionalCandidate } from '../../lib/matching/score-professionals.ts'
import { confirmCompletedJob } from '../../lib/workflows/service-lifecycle.ts'

export type ManagedServiceSimulationInput = {
  adminProfileId: string
  request: CustomerRequestCommand
  candidates: ProfessionalCandidate[]
  selectedProfessionalId?: string
  equipment: EquipmentRegistrationInput
  finalReport: FinalCloseoutCommand
  review: Omit<ReviewCloseoutInput, 'jobId' | 'customerId' | 'professionalId' | 'jobStatus' | 'alreadyReviewed' | 'previousRatingAvg' | 'previousJobsCompleted'> & {
    previousRatingAvg?: number | null
    previousJobsCompleted?: number
    alreadyReviewed?: boolean
  }
  receiptToken: string
  paymentProviderEventId?: string
  providerPaymentId?: string
}

export type ManagedServiceSimulationOutput = {
  requestId: string
  jobId: string
  professionalId: string
  amount: number
  platformFee: number
  professionalAmount: number
  finalJobStatus: JobStatus
  maintenanceDueDate: string | null
  publicReceiptHiddenFields: string[]
  qualityCaseOpened: boolean
  notificationEvents: string[]
  auditEvents: AuditEventDraft[]
  operationalChecklist: string[]
}

export function runManagedServiceSimulation(input: ManagedServiceSimulationInput): ManagedServiceSimulationOutput {
  if (!input.adminProfileId.trim()) throw new Error('admin_profile_id_required')
  const preparedRequest = prepareCustomerServiceRequest(input.request)
  const assignment = decideProfessionalAssignment({
    requestId: preparedRequest.id,
    jobId: `JOB-${preparedRequest.id.replace('REQ-', '')}`,
    requestStatus: 'pending_assignment',
    currentJobStatus: 'pending_assignment',
    paid: false,
    candidates: input.candidates,
    selectedProfessionalId: input.selectedProfessionalId,
    mode: input.selectedProfessionalId ? 'manual' : 'auto_suggested',
    adminProfileId: input.selectedProfessionalId ? input.adminProfileId : undefined,
    match: { serviceSlug: 'aire_acondicionado', zone: input.request.zone ?? 'caba', requiredToolScore: 6, maxDistanceKm: 35 }
  })
  if (!assignment.ok) throw new Error(`assignment_failed:${assignment.errors.join(',')}`)

  let jobStatus: JobStatus = assignment.nextJobStatus
  const professionalId = assignment.assignedProfessionalId
  const jobId = assignment.jobId ?? `JOB-${preparedRequest.id.replace('REQ-', '')}`
  jobStatus = applyProfessionalJobAction({ jobId, professionalId, currentStatus: jobStatus, action: 'accept' }).to
  const paymentDraft = createPaymentPreferenceDraft({
    requestId: preparedRequest.id,
    customerId: preparedRequest.customerId,
    amount: preparedRequest.paymentAmount,
    selectedOption: preparedRequest.selectedOption
  })
  const webhook = applyPaymentWebhook({
    event: {
      id: input.paymentProviderEventId ?? `evt-${preparedRequest.id}`,
      type: 'payment',
      data: { id: input.providerPaymentId ?? `mp-${preparedRequest.id}` },
      status: 'approved'
    },
    storedEvents: [],
    currentStatus: paymentDraft.status
  })
  if (webhook.toStatus !== 'approved') throw new Error('payment_not_approved')


  const jobActions: Array<'accept' | 'on_way' | 'arrived' | 'start_diagnosis' | 'start_work' | 'finish_work'> = ['on_way', 'arrived', 'start_diagnosis', 'start_work', 'finish_work']
  for (const action of jobActions) {
    const result = applyProfessionalJobAction({ jobId, professionalId, currentStatus: jobStatus, action })
    jobStatus = result.to
  }

  const equipmentValidation = validateEquipmentRegistration(input.equipment)
  if (!equipmentValidation.ok) throw new Error(`equipment_invalid:${equipmentValidation.errors.join(',')}`)

  const closeout = closeProfessionalJob(input.finalReport)
  jobStatus = closeout.nextStatus
  // The fixture explicitly simulates customer confirmation before the optional review.
  jobStatus = confirmCompletedJob({ requestStatus: 'assigned', jobStatus, hasFinalReport: true, events: [] }).jobStatus!
  const reviewCloseout = submitReviewCloseout({
    ...input.review,
    jobId,
    customerId: preparedRequest.customerId,
    professionalId,
    jobStatus,
    alreadyReviewed: input.review.alreadyReviewed ?? false,
    previousRatingAvg: input.review.previousRatingAvg ?? null,
    previousJobsCompleted: input.review.previousJobsCompleted ?? 0
  })
  const publicReceipt = buildPublicReceipt({
    token: input.receiptToken,
    jobId,
    serviceName: 'Aire acondicionado',
    date: '2026-08-19',
    professionalPublicName: input.candidates.find((candidate) => candidate.id === professionalId)?.name ?? 'Profesional Lysto',
    workDone: input.finalReport.workDone,
    warrantyText: closeout.warrantyUntil ? `Garantía hasta ${closeout.warrantyUntil}` : 'Sin garantía automática',
    nextMaintenanceText: closeout.maintenanceOption === 'none' ? 'Sin mantenimiento recomendado' : `Próximo mantenimiento sugerido: ${calculateDueDate(closeout.maintenanceOption) ?? 'a coordinar'}`
  })

  const auditEvents: AuditEventDraft[] = [
    { actorRole: 'admin', actorProfileId: input.adminProfileId, action: 'request_assigned', entityType: 'job', entityId: jobId, metadata: { professionalId, mode: assignment.auditAction } },
    ...(reviewCloseout.openQualityCase ? [{ actorRole: 'admin' as const, actorProfileId: input.adminProfileId, action: 'quality_case_opened' as const, entityType: 'job', entityId: jobId, reason: 'low_or_unresolved_review' }] : [])
  ]
  auditEvents.forEach((event) => {
    const errors = validateAuditEvent(event)
    if (errors.length) throw new Error(`audit_invalid:${errors.join(',')}`)
  })

  const notifications = [
    planPaymentNotification(paymentDraft.requestId, webhook.toStatus),
    planRequestStatusNotification(preparedRequest.id, 'payment_approved'),
    planRequestStatusNotification(preparedRequest.id, 'pending_assignment'),
    planRequestStatusNotification(preparedRequest.id, 'assigned'),
    planJobStatusNotification(jobId, 'confirmed'),
    planJobStatusNotification(jobId, 'technician_on_way'),
    planJobStatusNotification(jobId, 'arrived'),
    planJobStatusNotification(jobId, 'completed_pending_customer_confirmation'),
    planJobStatusNotification(jobId, 'completed')
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  return {
    requestId: preparedRequest.id,
    jobId,
    professionalId,
    amount: paymentDraft.amount,
    platformFee: paymentDraft.split.platformFee,
    professionalAmount: paymentDraft.split.professionalAmount,
    finalJobStatus: jobStatus,
    maintenanceDueDate: shouldCreateMaintenanceReminder(closeout.maintenanceOption) ? calculateDueDate(closeout.maintenanceOption) : null,
    publicReceiptHiddenFields: publicReceipt.hiddenFields,
    qualityCaseOpened: reviewCloseout.openQualityCase,
    notificationEvents: notifications.map((notification) => notification.event),
    auditEvents,
    operationalChecklist: [
      'customer_request_prepared',
      'payment_preference_created',
      'payment_webhook_applied_idempotently',
      'professional_assigned',
      'professional_accepted',
      'job_progressed_on_site',
      'equipment_registered',
      'technical_closeout_created',
      'public_receipt_generated',
      'customer_confirmed',
      'review_applied',
      'quality_checked',
      'notifications_planned',
      'audit_events_validated'
    ]
  }
}
