export type ReviewScore = {
  serviceRating: number
  professionalRating: number
  resolved: boolean
}

export function validateReview(score: ReviewScore): void {
  for (const value of [score.serviceRating, score.professionalRating]) {
    if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error('rating_must_be_1_to_5')
  }
}

export function calculateProfessionalRating(existingAverage: number, existingCount: number, newRating: number): { ratingAvg: number; jobsReviewed: number } {
  if (existingCount < 0) throw new Error('invalid_review_count')
  if (newRating < 1 || newRating > 5) throw new Error('invalid_rating')
  const jobsReviewed = existingCount + 1
  const ratingAvg = Math.round(((existingAverage * existingCount + newRating) / jobsReviewed) * 100) / 100
  return { ratingAvg, jobsReviewed }
}

export function shouldOpenQualityCase(score: ReviewScore): boolean {
  validateReview(score)
  return score.serviceRating <= 2 || score.professionalRating <= 2 || !score.resolved
}

export function recalculateProfessionalRating(input: { ratingAvg: number | null; jobsCompleted: number; newScore: ReviewScore }) {
  validateReview(input.newScore)
  const average = (input.newScore.serviceRating + input.newScore.professionalRating) / 2
  return calculateProfessionalRating(input.ratingAvg ?? 0, input.jobsCompleted, average)
}
