import type { MaintenanceOption } from '../domain/types.ts'

export type JobCloseoutFormInput = {
  jobId?: string
  equipmentId?: string
  realDiagnosis?: string
  workDone?: string
  partsUsed?: string
  finalState?: 'resolved' | 'partially_resolved' | 'pending_part' | 'requires_second_visit' | 'not_resolved'
  maintenanceOption?: MaintenanceOption
  afterPhotosCount?: number
  warrantyDays?: number
  internalNotes?: string
}

export type JobCloseoutValidation = { ok: boolean; errors: string[]; requiresCustomerApproval: boolean; createsWarranty: boolean }

function filled(value?: string): boolean { return Boolean((value ?? '').trim()) }

export function validateJobCloseoutForm(input: JobCloseoutFormInput): JobCloseoutValidation {
  const errors: string[] = []
  if (!filled(input.jobId)) errors.push('job_id_required')
  if (!filled(input.equipmentId)) errors.push('equipment_required')
  if (!filled(input.realDiagnosis)) errors.push('real_diagnosis_required')
  if (!filled(input.workDone)) errors.push('work_done_required')
  if (!input.finalState) errors.push('final_state_required')
  if ((input.afterPhotosCount ?? 0) < 1) errors.push('after_photo_required')
  if (input.finalState === 'pending_part' && !filled(input.partsUsed)) errors.push('pending_part_requires_parts_detail')
  if ((input.warrantyDays ?? 0) < 0) errors.push('warranty_days_invalid')
  const requiresCustomerApproval = input.finalState === 'partially_resolved' || input.finalState === 'requires_second_visit' || input.finalState === 'not_resolved'
  const createsWarranty = ['resolved', 'partially_resolved'].includes(input.finalState ?? '') && (input.warrantyDays ?? 0) > 0
  return { ok: errors.length === 0, errors, requiresCustomerApproval, createsWarranty }
}
