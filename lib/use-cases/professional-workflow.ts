import type { JobStatus, MaintenanceOption, ProfessionalStatus } from '../domain/types.ts'
import { assertTransition, jobTransitions, professionalTransitions } from '../domain/state-machine.ts'
import { validateJobFinalReport, type JobFinalReportInput } from '../jobs/final-report.ts'

export type OnboardingApplication = {
  professionalId: string
  currentStatus: ProfessionalStatus
  hasDni: boolean
  hasCuil: boolean
  hasLicense: boolean
  hasPhoto: boolean
  hasMobility: boolean
  toolScore: number
  zonesCount: number
  availabilitySlots: number
  paymentAccountConnected?: boolean
}

export type OnboardingReadiness = {
  readyForReview: boolean
  readyForApproval: boolean
  nextStatus: ProfessionalStatus
  missing: string[]
}

export function evaluateProfessionalOnboarding(input: OnboardingApplication): OnboardingReadiness {
  if (!input.professionalId.trim()) throw new Error('professional_id_required')
  const missing: string[] = []
  if (!input.hasDni) missing.push('dni')
  if (!input.hasCuil) missing.push('cuil')
  if (!input.hasLicense) missing.push('license')
  if (!input.hasPhoto) missing.push('photo')
  if (!input.hasMobility) missing.push('mobility')
  if (input.toolScore < 6) missing.push('tools')
  if (input.zonesCount < 1) missing.push('zones')
  if (input.availabilitySlots < 1) missing.push('availability')

  const readyForReview = missing.length === 0
  const readyForApproval = readyForReview && input.currentStatus === 'under_review'
  const nextStatus: ProfessionalStatus = readyForApproval ? 'approved' : readyForReview ? 'under_review' : 'form_started'
  if (input.currentStatus !== nextStatus) assertTransition(professionalTransitions, input.currentStatus, nextStatus, 'professional')
  return { readyForReview, readyForApproval, nextStatus, missing }
}

export type ProfessionalJobCommand = {
  jobId: string
  professionalId: string
  currentStatus: JobStatus
  action: 'accept' | 'reject' | 'on_way' | 'arrived' | 'start_diagnosis' | 'await_customer_approval' | 'start_work' | 'finish_work'
}

const actionToStatus: Record<ProfessionalJobCommand['action'], JobStatus> = {
  accept: 'confirmed',
  reject: 'pending_assignment',
  on_way: 'technician_on_way',
  arrived: 'arrived',
  start_diagnosis: 'onsite_diagnosis',
  await_customer_approval: 'waiting_customer_approval',
  start_work: 'in_progress',
  finish_work: 'completed_pending_customer_confirmation'
}

export function applyProfessionalJobAction(command: ProfessionalJobCommand): { jobId: string; professionalId: string; from: JobStatus; to: JobStatus; eventCode: string } {
  if (!command.jobId.trim()) throw new Error('job_id_required')
  if (!command.professionalId.trim()) throw new Error('professional_id_required')
  const to = actionToStatus[command.action]
  assertTransition(jobTransitions, command.currentStatus, to, 'job')
  return { jobId: command.jobId, professionalId: command.professionalId, from: command.currentStatus, to, eventCode: `job.${command.action}` }
}

export type FinalCloseoutCommand = JobFinalReportInput & {
  customerConfirmationRequired?: boolean
}

export function closeProfessionalJob(command: FinalCloseoutCommand): { nextStatus: JobStatus; maintenanceOption: MaintenanceOption; warrantyUntil?: string; requiresCustomerConfirmation: boolean } {
  const validation = validateJobFinalReport(command)
  if (!validation.ok) throw new Error(`invalid_final_report:${validation.errors.join(',')}`)
  return {
    nextStatus: 'completed_pending_customer_confirmation',
    maintenanceOption: command.maintenanceOption,
    warrantyUntil: validation.warrantyUntil,
    requiresCustomerConfirmation: command.customerConfirmationRequired ?? true
  }
}
