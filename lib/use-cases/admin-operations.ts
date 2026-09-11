import type { RequestStatus } from '../domain/types.ts'
import { rankProfessionals, type MatchInput, type ProfessionalCandidate, type ScoredCandidate } from '../matching/score-professionals.ts'
import { createAuditEvent } from '../admin/audit-events.ts'

export type AssignmentCommand = {
  adminProfileId: string
  requestId: string
  requestStatus: RequestStatus
  serviceSlug: string
  zone: string
  candidates: ProfessionalCandidate[]
  overrideProfessionalId?: string
}

export type AssignmentDecision = {
  requestId: string
  professional: ScoredCandidate
  mode: 'automatic_best_candidate' | 'admin_override'
  rankedCandidates: ScoredCandidate[]
  auditEvent: ReturnType<typeof createAuditEvent>
  nextRequestStatus: RequestStatus
}

export function createAssignmentDecision(command: AssignmentCommand): AssignmentDecision {
  if (!command.adminProfileId.trim()) throw new Error('admin_profile_id_required')
  if (!command.requestId.trim()) throw new Error('request_id_required')
  if (!['matching', 'pending_assignment'].includes(command.requestStatus)) throw new Error(`request_not_assignable:${command.requestStatus}`)

  const matchInput: MatchInput = { serviceSlug: command.serviceSlug, zone: command.zone, requiredToolScore: 6, maxDistanceKm: 35 }
  const rankedCandidates = rankProfessionals(command.candidates, matchInput)
  if (!rankedCandidates.length) throw new Error('no_eligible_professionals')

  const override = command.overrideProfessionalId ? rankedCandidates.find((candidate) => candidate.id === command.overrideProfessionalId) : undefined
  if (command.overrideProfessionalId && !override) throw new Error('override_professional_not_eligible')
  const professional = override ?? rankedCandidates[0]
  const mode = override ? 'admin_override' : 'automatic_best_candidate'

  return {
    requestId: command.requestId,
    professional,
    mode,
    rankedCandidates,
    nextRequestStatus: 'pending_professional_acceptance',
    auditEvent: createAuditEvent({
      action: mode === 'admin_override' ? 'job.reassigned' : 'job.assigned',
      actorProfileId: command.adminProfileId,
      entityType: 'service_request',
      entityId: command.requestId,
      metadata: { professionalId: professional.id, score: professional.score, mode }
    })
  }
}
