export type AuditAction =
  | 'professional.invited'
  | 'professional.approved'
  | 'professional.rejected'
  | 'professional.suspended'
  | 'job.assigned'
  | 'job.reassigned'
  | 'job.cancelled'
  | 'pricing.updated'
  | 'payment.refunded'
  | 'quality.case_opened'

export type AuditEventInput = {
  action: AuditAction
  actorProfileId: string
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
}

export function createAuditEvent(input: AuditEventInput) {
  if (!input.actorProfileId) throw new Error('Audit actor is required')
  if (!input.entityType) throw new Error('Audit entity type is required')
  if (!input.entityId) throw new Error('Audit entity id is required')
  return {
    ...input,
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString()
  }
}
