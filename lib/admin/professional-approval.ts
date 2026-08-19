import type { ProfessionalStatus } from '../domain/types.ts'
import type { ProfessionalOnboardingInput } from '../professional/onboarding.ts'
import { validateProfessionalOnboarding } from '../professional/onboarding.ts'

export type ProfessionalApprovalInput = {
  professionalId: string
  currentStatus: ProfessionalStatus
  onboarding: ProfessionalOnboardingInput
  documents: Array<{ type: string; status: 'pending' | 'approved' | 'rejected' }>
  adminProfileId?: string
  decision: 'approve' | 'reject' | 'request_changes' | 'suspend' | 'reactivate'
  reason?: string
}

export type ProfessionalApprovalResult = {
  ok: true
  nextStatus: ProfessionalStatus
  auditAction: string
  score: number
  reasons: string[]
} | {
  ok: false
  errors: string[]
  score: number
}

export function decideProfessionalApproval(input: ProfessionalApprovalInput): ProfessionalApprovalResult {
  const errors: string[] = []
  if (!input.professionalId.trim()) errors.push('professional_id_required')
  if (!input.adminProfileId) errors.push('admin_required')
  const validation = validateProfessionalOnboarding(input.onboarding)
  const hasIdentity = input.documents.some((document) => document.type === 'dni' && document.status === 'approved')
  const hasLicense = input.documents.some((document) => document.type === 'license' && document.status === 'approved')
  if (input.decision === 'approve') {
    if (!['under_review', 'form_submitted'].includes(input.currentStatus)) errors.push('status_not_approvable')
    if (!validation.valid) errors.push(...validation.errors.map((error) => `onboarding_${error}`))
    if (!hasIdentity) errors.push('dni_document_required')
    if (!hasLicense) errors.push('license_document_required')
  }
  if (input.decision === 'reject' && !input.reason?.trim()) errors.push('rejection_reason_required')
  if (input.decision === 'suspend' && !input.reason?.trim()) errors.push('suspension_reason_required')
  if (input.decision === 'reactivate' && input.currentStatus !== 'suspended') errors.push('only_suspended_professionals_can_be_reactivated')
  if (errors.length) return { ok: false, errors, score: validation.readinessScore }

  const nextStatus: ProfessionalStatus = input.decision === 'approve'
    ? 'approved'
    : input.decision === 'reject'
      ? 'rejected'
      : input.decision === 'suspend'
        ? 'suspended'
        : input.decision === 'reactivate'
          ? 'approved'
          : 'under_review'

  return {
    ok: true,
    nextStatus,
    auditAction: `professional_${input.decision}`,
    score: validation.readinessScore,
    reasons: validation.errors
  }
}
