import type { JobStatus, RequestStatus } from '../domain/types.ts'
import {
  rankProfessionals,
  type MatchInput,
  type ProfessionalCandidate,
  type ScoredCandidate
} from '../matching/score-professionals.ts'

export type AssignmentMode = 'manual' | 'auto_suggested' | 'auto_send_first'
export type AssignmentOfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled'

export function validateOfferExpiry(expiresAt: string, now = new Date()) {
  const value = Date.parse(expiresAt)
  if (!Number.isFinite(value)) throw new Error('invalid_offer_expiry')
  if (value <= now.getTime()) throw new Error('offer_expired')
  if (value - now.getTime() > 120 * 60_000) throw new Error('offer_expiry_too_far')
  return new Date(value).toISOString()
}

export function decideOfferResponse(
  status: AssignmentOfferStatus,
  response: 'accepted' | 'rejected',
  expiresAt: string,
  now = new Date(),
  reason?: string
) {
  if (status === response) return status
  if (status === 'expired' || Date.parse(expiresAt) <= now.getTime())
    throw new Error('offer_expired')
  if (status !== 'pending') throw new Error('offer_not_pending')
  if (response === 'rejected' && (reason?.trim().length ?? 0) < 10)
    throw new Error('rejection_reason_required')
  return response
}

export type AssignmentInput = {
  requestId: string
  jobId?: string
  requestStatus: RequestStatus
  currentJobStatus?: JobStatus
  /** Historical callers may supply it; money does not authorize assignment. */
  paid?: boolean
  candidates: ProfessionalCandidate[]
  match?: MatchInput
  selectedProfessionalId?: string
  mode: AssignmentMode
  adminProfileId?: string
}

export type AssignmentDecision =
  | {
      ok: true
      requestId: string
      jobId?: string
      assignedProfessionalId: string
      nextRequestStatus: RequestStatus
      nextJobStatus: JobStatus
      ranking: ScoredCandidate[]
      auditAction: 'professional_assigned' | 'professional_suggested'
      notificationEvents: Array<'professional_assignment_requested' | 'customer_matching_started'>
    }
  | {
      ok: false
      errors: string[]
      ranking: ScoredCandidate[]
    }

export function decideProfessionalAssignment(input: AssignmentInput): AssignmentDecision {
  const errors: string[] = []
  if (!input.requestId.trim()) errors.push('request_id_required')
  if (!['pending_assignment', 'matching'].includes(input.requestStatus))
    errors.push('request_not_assignable')
  if (
    input.currentJobStatus &&
    !['pending_assignment', 'pending_professional_acceptance'].includes(input.currentJobStatus)
  )
    errors.push('job_not_assignable')
  if (input.mode === 'manual' && !input.adminProfileId)
    errors.push('manual_assignment_requires_admin')

  const match = input.match ?? {
    serviceSlug: 'aire_acondicionado',
    zone: 'caba',
    requiredToolScore: 6,
    maxDistanceKm: 35
  }
  const ranking = rankProfessionals(input.candidates, match)
  if (ranking.length === 0) errors.push('no_eligible_professionals')

  const selected = input.selectedProfessionalId
    ? ranking.find((candidate) => candidate.id === input.selectedProfessionalId)
    : ranking[0]

  if (!selected && ranking.length > 0) errors.push('selected_professional_not_eligible')
  if (errors.length || !selected) return { ok: false, errors, ranking }

  return {
    ok: true,
    requestId: input.requestId,
    jobId: input.jobId,
    assignedProfessionalId: selected.id,
    nextRequestStatus: 'pending_professional_acceptance',
    nextJobStatus: 'pending_professional_acceptance',
    ranking,
    auditAction: input.mode === 'manual' ? 'professional_assigned' : 'professional_suggested',
    notificationEvents: ['professional_assignment_requested', 'customer_matching_started']
  }
}

export function reassignAfterProfessionalRejection(
  jobStatus: JobStatus,
  availableCandidates: ProfessionalCandidate[]
): AssignmentDecision {
  if (jobStatus !== 'pending_professional_acceptance') {
    return {
      ok: false,
      errors: ['job_not_waiting_professional_acceptance'],
      ranking: rankProfessionals(availableCandidates, {
        serviceSlug: 'aire_acondicionado',
        zone: 'caba',
        requiredToolScore: 6,
        maxDistanceKm: 35
      })
    }
  }
  return decideProfessionalAssignment({
    requestId: 'reassignment',
    requestStatus: 'pending_assignment',
    currentJobStatus: 'pending_assignment',
    paid: true,
    candidates: availableCandidates,
    mode: 'auto_suggested'
  })
}
