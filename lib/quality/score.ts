export type ReviewInput = {
  serviceRating: number
  professionalRating: number
  solved: boolean
  wouldHireAgain: boolean
  complaintOpened?: boolean
}

export type ProfessionalQualityMetrics = {
  jobsCompleted: number
  ratingAverage: number
  acceptanceRate: number
  punctualityRate: number
  complaintRate: number
  warrantyClaimRate: number
  internalBonus?: number
}

export function validateReview(input: ReviewInput): string[] {
  const errors: string[] = []
  if (!Number.isInteger(input.serviceRating) || input.serviceRating < 1 || input.serviceRating > 5) errors.push('serviceRating must be 1-5')
  if (!Number.isInteger(input.professionalRating) || input.professionalRating < 1 || input.professionalRating > 5) errors.push('professionalRating must be 1-5')
  return errors
}

export function calculateReviewImpact(input: ReviewInput): number {
  const errors = validateReview(input)
  if (errors.length) throw new Error(errors.join(', '))
  let score = ((input.serviceRating + input.professionalRating) / 10) * 70
  if (input.solved) score += 15
  if (input.wouldHireAgain) score += 10
  if (input.complaintOpened) score -= 25
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function calculateProfessionalScore(metrics: ProfessionalQualityMetrics): number {
  const baseRating = Math.min(5, Math.max(0, metrics.ratingAverage)) / 5 * 35
  const acceptance = Math.min(1, Math.max(0, metrics.acceptanceRate)) * 15
  const punctuality = Math.min(1, Math.max(0, metrics.punctualityRate)) * 20
  const experience = Math.min(20, Math.log10(Math.max(1, metrics.jobsCompleted)) * 12)
  const complaintPenalty = Math.min(25, Math.max(0, metrics.complaintRate) * 50)
  const warrantyPenalty = Math.min(15, Math.max(0, metrics.warrantyClaimRate) * 40)
  const bonus = metrics.internalBonus ?? 0
  return Math.max(0, Math.min(100, Math.round(baseRating + acceptance + punctuality + experience + bonus - complaintPenalty - warrantyPenalty)))
}

export function shouldFlagQualityReview(metrics: ProfessionalQualityMetrics): boolean {
  return metrics.ratingAverage < 4 || metrics.complaintRate > 0.08 || metrics.warrantyClaimRate > 0.12 || metrics.punctualityRate < 0.75
}
