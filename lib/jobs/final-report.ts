import type { MaintenanceOption } from '../domain/types.ts'

export type JobResolutionStatus = 'resolved' | 'partially_resolved' | 'pending_part' | 'second_visit_required' | 'not_resolved'

export type JobFinalReportInput = {
  jobId: string
  equipmentId?: string
  realDiagnosis: string
  workDone: string
  resolutionStatus: JobResolutionStatus
  maintenanceOption: MaintenanceOption
  photosAfterCount: number
  partsUsed?: string[]
  warrantyDays?: number
}

export type JobFinalReportValidation = { ok: true; warrantyUntil?: string } | { ok: false; errors: string[] }

export function validateJobFinalReport(input: JobFinalReportInput, now = new Date('2026-08-19T12:00:00.000Z')): JobFinalReportValidation {
  const errors: string[] = []
  if (!input.jobId.trim()) errors.push('job_id_required')
  if (!input.equipmentId) errors.push('equipment_required')
  if (!input.realDiagnosis.trim()) errors.push('real_diagnosis_required')
  if (!input.workDone.trim()) errors.push('work_done_required')
  if (input.photosAfterCount < 1) errors.push('after_photo_required')
  if ((input.resolutionStatus === 'pending_part' || input.resolutionStatus === 'second_visit_required') && (!input.partsUsed || input.partsUsed.length === 0)) errors.push('pending_parts_required')
  if (input.warrantyDays !== undefined && input.warrantyDays < 0) errors.push('invalid_warranty_days')
  if (errors.length) return { ok: false, errors }
  const warrantyDays = input.warrantyDays ?? defaultWarrantyDays(input.resolutionStatus)
  const warrantyUntil = warrantyDays > 0 ? addDaysIso(now, warrantyDays) : undefined
  return { ok: true, warrantyUntil }
}

export function defaultWarrantyDays(status: JobResolutionStatus): number {
  switch (status) {
    case 'resolved': return 30
    case 'partially_resolved': return 7
    case 'pending_part': return 0
    case 'second_visit_required': return 0
    case 'not_resolved': return 0
  }
}

function addDaysIso(date: Date, days: number): string {
  const copy = new Date(date)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy.toISOString().slice(0, 10)
}
