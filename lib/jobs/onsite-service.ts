import 'server-only'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'

const uuid = z.string().uuid(),
  status = z.enum([
    'confirmed',
    'technician_on_way',
    'arrived',
    'onsite_diagnosis',
    'waiting_customer_approval'
  ])
export const onsiteActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('advance'),
      jobId: uuid,
      expectedStatus: status.exclude(['waiting_customer_approval']),
      idempotencyKey: uuid
    })
    .strict(),
  z
    .object({
      action: z.literal('submitDiagnosis'),
      jobId: uuid,
      expectedStatus: z.enum(['onsite_diagnosis', 'waiting_customer_approval']),
      actualDiagnosis: z.string().trim().min(10).max(5000),
      baseScope: z.string().trim().min(10).max(5000),
      equipmentId: uuid,
      evidenceIds: z
        .array(uuid)
        .min(1)
        .max(5)
        .refine((ids) => new Set(ids).size === ids.length),
      idempotencyKey: uuid
    })
    .strict(),
  z
    .object({
      action: z.literal('decideScope'),
      jobId: uuid,
      decision: z.enum(['accepted', 'changes_requested']),
      reason: z.string().trim().max(2000).optional(),
      expectedVersion: z.number().int().positive(),
      idempotencyKey: uuid
    })
    .strict()
])
export const extraActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('propose'),
      jobId: uuid,
      fault: z.string().trim().min(5).max(500),
      description: z.string().trim().min(10).max(2000),
      amount: z.number().finite().positive().max(100_000_000).multipleOf(0.01),
      idempotencyKey: uuid
    })
    .strict(),
  z
    .object({
      action: z.literal('decide'),
      extraId: uuid,
      decision: z.enum(['accepted', 'rejected']),
      idempotencyKey: uuid
    })
    .strict()
])
function fail(code?: string, message?: string): never {
  if (code === '42501') throw new ApiError('forbidden')
  if (code === 'P0002') throw new ApiError('not_found')
  if (code === '40001' || code === '23505') throw new ApiError('conflict')
  if (code?.startsWith('22') || code === '23514') throw new ApiError('invalid_input')
  if (message?.includes('payment')) throw new ApiError('conflict')
  throw new ApiError('service_unavailable')
}
async function rpc(session: Session, name: string, args: Record<string, unknown>) {
  const result = await (
    session.client.rpc as unknown as (
      n: string,
      a: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>
  )(name, args)
  if (result.error) fail(result.error.code, result.error.message)
  return result.data
}
export async function mutateOnsite(session: Session, input: unknown) {
  const value = onsiteActionSchema.parse(input)
  if (value.action === 'advance') {
    if (session.role !== 'professional') throw new ApiError('forbidden')
    return rpc(session, 'advance_service_job_v2', {
      p_job_id: value.jobId,
      p_expected_status: value.expectedStatus,
      p_idempotency_key: value.idempotencyKey
    })
  }
  if (value.action === 'submitDiagnosis') {
    if (session.role !== 'professional') throw new ApiError('forbidden')
    return rpc(session, 'submit_onsite_diagnosis', {
      p_job_id: value.jobId,
      p_expected_status: value.expectedStatus,
      p_actual_diagnosis: value.actualDiagnosis,
      p_base_scope: value.baseScope,
      p_equipment_id: value.equipmentId,
      p_evidence_ids: value.evidenceIds,
      p_idempotency_key: value.idempotencyKey
    })
  }
  if (session.role !== 'customer') throw new ApiError('forbidden')
  if (value.decision === 'changes_requested' && (!value.reason || value.reason.length < 10))
    throw new ApiError('invalid_input')
  return rpc(session, 'decide_onsite_scope', {
    p_job_id: value.jobId,
    p_decision: value.decision,
    p_reason: value.reason ?? null,
    p_expected_version: value.expectedVersion,
    p_idempotency_key: value.idempotencyKey
  })
}
export async function mutateExtra(session: Session, input: unknown) {
  const value = extraActionSchema.parse(input)
  if (value.action === 'propose') {
    if (session.role !== 'professional') throw new ApiError('forbidden')
    return rpc(session, 'propose_job_extra', {
      p_job_id: value.jobId,
      p_fault: value.fault,
      p_description: value.description,
      p_amount: value.amount,
      p_idempotency_key: value.idempotencyKey
    })
  }
  if (session.role !== 'customer') throw new ApiError('forbidden')
  return rpc(session, 'decide_job_extra_v2', {
    p_extra_id: value.extraId,
    p_decision: value.decision,
    p_idempotency_key: value.idempotencyKey
  })
}
