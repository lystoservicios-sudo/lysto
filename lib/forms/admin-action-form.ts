import type { JobStatus, ProfessionalStatus, RequestStatus } from '../domain/types.ts'

export type AdminActionInput =
  | { type: 'invite_professional'; email?: string; specialtySlug?: string; expiresInDays?: number }
  | { type: 'approve_professional'; professionalId?: string; currentStatus?: ProfessionalStatus; adminProfileId?: string }
  | { type: 'assign_professional'; requestId?: string; jobId?: string; professionalId?: string; requestStatus?: RequestStatus; jobStatus?: JobStatus; adminProfileId?: string }
  | { type: 'update_pricing'; ruleId?: string; baseAmount?: number; adminProfileId?: string }
  | { type: 'open_quality_case'; jobId?: string; severity?: 'low' | 'medium' | 'high' | 'critical'; description?: string; adminProfileId?: string }

export function validateAdminAction(input: AdminActionInput): { ok: boolean; errors: string[]; auditAction: string } {
  const errors: string[] = []
  const auditAction = `admin.${input.type}`
  const must = (condition: boolean, code: string) => { if (!condition) errors.push(code) }
  switch (input.type) {
    case 'invite_professional':
      must(Boolean(input.email?.includes('@')), 'valid_email_required')
      must(Boolean(input.specialtySlug), 'specialty_required')
      must((input.expiresInDays ?? 0) > 0 && (input.expiresInDays ?? 0) <= 30, 'expiration_invalid')
      break
    case 'approve_professional':
      must(Boolean(input.adminProfileId), 'admin_profile_required')
      must(Boolean(input.professionalId), 'professional_required')
      must(input.currentStatus === 'under_review', 'professional_must_be_under_review')
      break
    case 'assign_professional':
      must(Boolean(input.adminProfileId), 'admin_profile_required')
      must(Boolean(input.requestId), 'request_required')
      must(Boolean(input.jobId), 'job_required')
      must(Boolean(input.professionalId), 'professional_required')
      must(['payment_approved', 'matching', 'pending_assignment'].includes(input.requestStatus ?? ''), 'request_not_assignable')
      must(input.jobStatus === 'pending_assignment', 'job_not_pending_assignment')
      break
    case 'update_pricing':
      must(Boolean(input.adminProfileId), 'admin_profile_required')
      must(Boolean(input.ruleId), 'rule_required')
      must((input.baseAmount ?? -1) >= 0, 'base_amount_invalid')
      break
    case 'open_quality_case':
      must(Boolean(input.adminProfileId), 'admin_profile_required')
      must(Boolean(input.jobId), 'job_required')
      must(Boolean(input.description?.trim()), 'description_required')
      must(['low', 'medium', 'high', 'critical'].includes(input.severity ?? ''), 'severity_required')
      break
  }
  return { ok: errors.length === 0, errors, auditAction }
}
