import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'

const uuid = z.string().uuid()
const openSchema = z
  .object({
    jobId: uuid.optional(),
    category: z.enum(['delay', 'payment', 'quality', 'safety', 'warranty', 'other']),
    description: z.string().trim().min(10).max(3000),
    hasSafetyRisk: z.boolean().optional(),
    paymentBlocked: z.boolean().optional(),
    customerWaiting: z.boolean().optional(),
    evidenceIds: z.array(uuid).max(10).default([]),
    idempotencyKey: uuid
  })
  .strict()
const warrantySchema = z
  .object({
    jobId: uuid,
    description: z.string().trim().min(10).max(3000),
    sameProblem: z.boolean(),
    evidenceIds: z.array(uuid).max(10).default([]),
    idempotencyKey: uuid
  })
  .strict()
const updateSchema = z
  .object({
    action: z.enum([
      'start_review',
      'wait_customer',
      'wait_professional',
      'customer_replied',
      'professional_replied',
      'resolve',
      'reject',
      'reopen'
    ]),
    expectedVersion: z.number().int().positive(),
    publicMessage: z.string().trim().min(2).max(3000).optional(),
    internalNote: z.string().trim().min(2).max(3000).optional(),
    assignedTo: uuid.optional(),
    evidenceIds: z.array(uuid).max(10).default([]),
    resolutionReason: z.string().trim().min(10).max(3000).optional(),
    communicationFailed: z.boolean().optional()
  })
  .strict()
const warrantyDecisionSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(10).max(3000)
  })
  .strict()
const caseResult = z
  .object({
    id: uuid,
    status: z.string(),
    severity: z.string().optional(),
    dueAt: z.string().nullable().optional(),
    version: z.number().int().optional(),
    idempotent: z.boolean().optional()
  })
  .passthrough()
const mapError = (error: { code?: string } | null) => {
  if (error?.code === '40001' || error?.code === 'PT409') return new ApiError('conflict')
  if (error?.code === 'P0002') return new ApiError('not_found')
  if (error?.code === '22023') return new ApiError('invalid_input')
  if (error?.code === '42501') return new ApiError('forbidden')
  return new ApiError('service_unavailable')
}
async function rpc(session: Session, name: string, args: Record<string, unknown>) {
  const result = await session.client.rpc(name as never, args as never)
  if (result.error) throw mapError(result.error)
  return result.data
}
export async function openSupportCase(session: Session, raw: unknown) {
  const i = openSchema.parse(raw)
  return caseResult.parse(
    await rpc(session, 'open_support_case', {
      p_job_id: i.jobId ?? null,
      p_category: i.category,
      p_description: i.description,
      p_has_safety_risk: i.hasSafetyRisk ?? false,
      p_payment_blocked: i.paymentBlocked ?? false,
      p_customer_waiting: i.customerWaiting ?? false,
      p_evidence_ids: i.evidenceIds,
      p_idempotency_key: i.idempotencyKey
    })
  )
}
export async function openWarrantyClaim(session: Session, raw: unknown) {
  const i = warrantySchema.parse(raw)
  return z
    .object({
      id: uuid,
      caseId: uuid,
      status: z.string(),
      coverageEligible: z.boolean(),
      coverageUntil: z.string().nullable(),
      supportContinues: z.boolean().optional(),
      idempotent: z.boolean()
    })
    .parse(
      await rpc(session, 'open_warranty_claim', {
        p_job_id: i.jobId,
        p_description: i.description,
        p_same_problem: i.sameProblem,
        p_evidence_ids: i.evidenceIds,
        p_idempotency_key: i.idempotencyKey
      })
    )
}
export async function updateSupportCase(session: Session, caseId: string, raw: unknown) {
  const id = uuid.parse(caseId),
    i = updateSchema.parse(raw)
  const result = caseResult.parse(
    await rpc(session, 'update_support_case', {
      p_case_id: id,
      p_action: i.action,
      p_expected_version: i.expectedVersion,
      p_public_message: i.publicMessage ?? null,
      p_internal_note: i.internalNote ?? null,
      p_assigned_to: i.assignedTo ?? null,
      p_evidence_ids: i.evidenceIds,
      p_resolution_reason: i.resolutionReason ?? null,
      p_communication_failed: i.communicationFailed ?? false
    })
  )
  return session.role === 'admin' ? result : caseResult.strip().parse(result)
}
export async function replyCustomerSupportCase(session: Session, caseId: string, raw: unknown) {
  if (session.role !== 'customer' || !session.customerId) throw new ApiError('forbidden')
  const input = z.object({ action: z.literal('customer_replied'), expectedVersion: z.number().int().positive(), publicMessage: z.string().trim().min(2).max(3000), evidenceIds: z.array(uuid).max(10).default([]), idempotencyKey: uuid }).strict().parse(raw)
  return caseResult.strip().parse(await rpc(session, 'reply_customer_support_case', { p_case_id: uuid.parse(caseId), p_expected_version: input.expectedVersion, p_public_message: input.publicMessage, p_evidence_ids: input.evidenceIds, p_idempotency_key: input.idempotencyKey }))
}
export async function listSupportCases(session: Session, limit: number) {
  const cases = z
    .array(
      z.object({
        id: uuid,
        jobId: uuid.nullable(),
        category: z.string(),
        status: z.string(),
        severity: z.string(),
        description: z.string(),
        dueAt: z.string().nullable(),
        assignedTo: uuid.nullable(),
        publicResolution: z.string().nullable(),
        version: z.number().int(),
        createdAt: z.string(),
        warrantyClaim: z
          .object({
            id: uuid,
            status: z.string(),
            version: z.number().int(),
            coverageEligible: z.boolean(),
            coverageUntil: z.string().nullable(),
            revisitJobId: uuid.nullable()
          })
          .nullable(),
        events: z.array(
          z.object({
            id: uuid,
            type: z.string(),
            fromStatus: z.string().nullable(),
            toStatus: z.string().nullable(),
            message: z.string().nullable(),
            internalNote: z.string().nullable(),
            evidenceIds: z.array(uuid),
            createdAt: z.string()
          })
        )
      })
    )
    .parse(
      await rpc(session, 'list_support_cases', {
        p_limit: z.number().int().min(1).max(100).parse(limit)
      })
    )
  return cases.map((item) => ({
    id: item.id, jobId: item.jobId, category: item.category, status: item.status,
    severity: item.severity, description: item.description, dueAt: item.dueAt,
    publicResolution: item.publicResolution, version: item.version, createdAt: item.createdAt,
    warrantyClaim: item.warrantyClaim,
    ...(session.role === 'admin' ? { assignedTo: item.assignedTo } : {}),
    events: item.events.map((event) => ({
      id: event.id, type: event.type, fromStatus: event.fromStatus, toStatus: event.toStatus,
      message: event.message, evidenceIds: event.evidenceIds, createdAt: event.createdAt,
      ...(session.role === 'admin' ? { internalNote: event.internalNote } : {})
    }))
  }))
}
export async function decideWarrantyClaim(session: Session, claimId: string, raw: unknown) {
  const id = uuid.parse(claimId),
    i = warrantyDecisionSchema.parse(raw)
  return z
    .object({
      id: uuid,
      status: z.string(),
      version: z.number().int(),
      revisitJobId: uuid.nullable(),
      billingPolicy: z.string().nullable()
    })
    .parse(
      await rpc(session, 'decide_warranty_claim', {
        p_claim_id: id,
        p_decision: i.decision,
        p_expected_version: i.expectedVersion,
        p_reason: i.reason
      })
    )
}
