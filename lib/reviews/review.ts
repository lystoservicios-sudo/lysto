export type ReviewInput = {
  jobStatus: 'completed' | string
  alreadyReviewed: boolean
  serviceRating: number
  professionalRating: number
  problemResolved?: boolean
  wouldHireAgain?: boolean
  comment?: string
}

export type ReviewScoreImpact = {
  accepted: true
  averageRating: number
  scoreDelta: number
  tags: string[]
}

export function submitReview(input: ReviewInput): ReviewScoreImpact {
  if (input.jobStatus !== 'completed') throw new Error('Only completed jobs can be reviewed')
  if (input.alreadyReviewed) throw new Error('Job already reviewed')
  if (!Number.isInteger(input.serviceRating) || input.serviceRating < 1 || input.serviceRating > 5) throw new Error('Invalid service rating')
  if (!Number.isInteger(input.professionalRating) || input.professionalRating < 1 || input.professionalRating > 5) throw new Error('Invalid professional rating')
  const averageRating = Number(((input.serviceRating + input.professionalRating) / 2).toFixed(2))
  const tags: string[] = []
  if (input.problemResolved === true) tags.push('resolved')
  if (input.problemResolved === false) tags.push('unresolved')
  if (input.wouldHireAgain === true) tags.push('loyalty_signal')
  if (averageRating <= 2.5) tags.push('quality_alert')
  if (averageRating >= 4.5) tags.push('positive_signal')
  const scoreDelta = averageRating >= 4.5 ? 4 : averageRating <= 2.5 ? -8 : 0
  return { accepted: true, averageRating, scoreDelta, tags }
}

export type ReviewCommandInput = ReviewInput & {
  jobId: string
  customerId: string
  professionalId: string
}

export function assertCanReviewJob(input: ReviewCommandInput): void {
  if (!input.jobId.trim()) throw new Error('job_id_required')
  if (!input.customerId.trim()) throw new Error('customer_id_required')
  if (!input.professionalId.trim()) throw new Error('professional_id_required')
  submitReview(input)
}

export function createReviewCommand(input: ReviewCommandInput) {
  const impact = submitReview(input)
  return {
    jobId: input.jobId,
    customerId: input.customerId,
    professionalId: input.professionalId,
    serviceRating: input.serviceRating,
    professionalRating: input.professionalRating,
    problemResolved: input.problemResolved ?? input.jobStatus === 'completed',
    wouldHireAgain: input.wouldHireAgain ?? impact.averageRating >= 4,
    comment: input.comment?.trim() || undefined,
    impact
  }
}
