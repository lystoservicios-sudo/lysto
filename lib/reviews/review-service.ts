import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'

export const reviewInput = z
  .object({
    jobId: z.string().uuid(),
    serviceRating: z.number().int().min(1).max(5),
    professionalRating: z.number().int().min(1).max(5),
    problemResolved: z.boolean(),
    wouldHireAgain: z.boolean(),
    comment: z.string().trim().max(800).optional(),
    idempotencyKey: z.string().uuid()
  })
  .strict()
const response = z.object({
  reviewId: z.string().uuid(),
  jobId: z.string().uuid(),
  status: z.literal('completed'),
  idempotent: z.boolean()
})
export async function persistReview(session: Session, raw: unknown) {
  const input = reviewInput.parse(raw)
  const result = await session.client.rpc('submit_customer_review_transaction', {
    p_job_id: input.jobId,
    p_service_rating: input.serviceRating,
    p_professional_rating: input.professionalRating,
    p_problem_resolved: input.problemResolved,
    p_would_hire_again: input.wouldHireAgain,
    p_comment: input.comment ?? '',
    p_idempotency_key: input.idempotencyKey
  })
  if (result.error) {
    if (result.error.code === '40001') throw new ApiError('conflict')
    if (result.error.code === 'P0002') throw new ApiError('not_found')
    if (result.error.code === '22023') throw new ApiError('invalid_input')
    if (result.error.code === '42501') throw new ApiError('forbidden')
    throw new ApiError('service_unavailable')
  }
  return response.parse(result.data)
}
