import type { JobStatus, RequestStatus } from '../domain/types.ts'

export type ProfessionalResponseInput = {
  professionalId: string
  assignedProfessionalId: string
  requestStatus: RequestStatus
  jobStatus: JobStatus
  response: 'accept' | 'reject'
  reason?: string
}

export type ProfessionalResponseResult = {
  ok: true
  nextRequestStatus: RequestStatus
  nextJobStatus: JobStatus
  auditAction: 'professional_accepted_job' | 'professional_rejected_job'
  notificationEvents: Array<'customer_professional_confirmed' | 'admin_reassignment_required'>
} | { ok: false; errors: string[] }

export function handleProfessionalResponse(input: ProfessionalResponseInput): ProfessionalResponseResult {
  const errors: string[] = []
  if (!input.professionalId || input.professionalId !== input.assignedProfessionalId) errors.push('professional_not_assigned_to_job')
  if (input.requestStatus !== 'pending_professional_acceptance') errors.push('request_not_waiting_professional')
  if (input.jobStatus !== 'pending_professional_acceptance') errors.push('job_not_waiting_professional')
  if (input.response === 'reject' && !input.reason?.trim()) errors.push('reject_reason_required')
  if (errors.length) return { ok: false, errors }
  if (input.response === 'accept') {
    return {
      ok: true,
      nextRequestStatus: 'assigned',
      nextJobStatus: 'confirmed',
      auditAction: 'professional_accepted_job',
      notificationEvents: ['customer_professional_confirmed']
    }
  }
  return {
    ok: true,
    nextRequestStatus: 'pending_assignment',
    nextJobStatus: 'pending_assignment',
    auditAction: 'professional_rejected_job',
    notificationEvents: ['admin_reassignment_required']
  }
}
