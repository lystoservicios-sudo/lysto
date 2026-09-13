import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
import { nullableRpcArgument } from '@/lib/supabase/rpc-arguments'

export const customerDecisionInput = z
  .object({
    jobId: z.string().uuid(),
    decision: z.enum(['confirmed', 'disputed']),
    reason: z.string().trim().min(10).max(3000).optional(),
    idempotencyKey: z.string().uuid()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.decision === 'disputed' && !value.reason)
      context.addIssue({ code: 'custom', message: 'dispute_reason_required' })
    if (value.decision === 'confirmed' && value.reason)
      context.addIssue({ code: 'custom', message: 'confirmation_has_no_reason' })
  })
const responseSchema = z.object({
  jobId: z.string().uuid(),
  decisionId: z.string().uuid(),
  decision: z.enum(['confirmed', 'disputed']),
  status: z.enum(['completed', 'disputed']),
  idempotent: z.boolean()
})
const mapError = (error: { code?: string } | null) => {
  if (error?.code === '40001') return new ApiError('conflict')
  if (error?.code === 'P0002') return new ApiError('not_found')
  if (error?.code === '22023') return new ApiError('invalid_input')
  if (error?.code === '42501') return new ApiError('forbidden')
  return new ApiError('service_unavailable')
}
export async function confirmJobOutcome(session: Session, raw: unknown) {
  const input = customerDecisionInput.parse(raw)
  const result = await session.client.rpc('confirm_job_outcome', {
    p_job_id: input.jobId,
    p_decision: input.decision,
    p_reason: nullableRpcArgument(input.reason ?? null),
    p_idempotency_key: input.idempotencyKey
  })
  if (result.error) throw mapError(result.error)
  return responseSchema.parse(result.data)
}
