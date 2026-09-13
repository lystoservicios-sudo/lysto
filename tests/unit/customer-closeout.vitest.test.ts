// @vitest-environment node
import { expect, it } from 'vitest'
import { customerDecisionInput } from '@/lib/jobs/customer-confirmation'
import { reviewInput } from '@/lib/reviews/review-service'
const jobId = '10000000-0000-4000-8000-000000000001',
  idempotencyKey = '10000000-0000-4000-8000-000000000002'
it('keeps confirmation and dispute explicit', () => {
  expect(
    customerDecisionInput.parse({ jobId, decision: 'confirmed', idempotencyKey }).decision
  ).toBe('confirmed')
  expect(() =>
    customerDecisionInput.parse({ jobId, decision: 'disputed', idempotencyKey })
  ).toThrow()
  expect(() =>
    customerDecisionInput.parse({
      jobId,
      decision: 'confirmed',
      reason: 'No debe existir',
      idempotencyKey
    })
  ).toThrow()
})
it('requires a complete optional review only after confirmation', () => {
  const valid = {
    jobId,
    serviceRating: 5,
    professionalRating: 4,
    problemResolved: true,
    wouldHireAgain: true,
    idempotencyKey
  }
  expect(reviewInput.parse(valid).serviceRating).toBe(5)
  expect(() => reviewInput.parse({ ...valid, serviceRating: 0 })).toThrow()
  expect(() => reviewInput.parse({ ...valid, comment: 'x'.repeat(801) })).toThrow()
})
