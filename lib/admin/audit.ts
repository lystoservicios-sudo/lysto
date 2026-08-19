import type { UserRole } from '../domain/types.ts'

export type AdminAction =
  | 'professional_invited'
  | 'professional_approved'
  | 'professional_rejected'
  | 'professional_suspended'
  | 'request_assigned'
  | 'request_reassigned'
  | 'job_cancelled'
  | 'price_rule_updated'
  | 'payment_refund_requested'
  | 'quality_case_opened'

export type AuditEventDraft = {
  actorRole: UserRole
  actorProfileId?: string
  action: AdminAction
  entityType: string
  entityId: string
  reason?: string
  metadata?: Record<string, unknown>
}

export function validateAuditEvent(event: AuditEventDraft): string[] {
  const errors: string[] = []
  if (event.actorRole !== 'admin') errors.push('actorRole must be admin')
  if (!event.actorProfileId) errors.push('actorProfileId is required')
  if (!event.entityType.trim()) errors.push('entityType is required')
  if (!event.entityId.trim()) errors.push('entityId is required')
  if ((event.action === 'job_cancelled' || event.action === 'professional_suspended' || event.action === 'payment_refund_requested') && !event.reason?.trim()) errors.push('reason is required for critical action')
  return errors
}

export function assertAuditEvent(event: AuditEventDraft): void {
  const errors = validateAuditEvent(event)
  if (errors.length) throw new Error(`Invalid audit event: ${errors.join(', ')}`)
}
