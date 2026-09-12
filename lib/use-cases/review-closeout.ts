import {
  assertCanReviewJob,
  createReviewCommand,
  type ReviewCommandInput
} from '../reviews/review.ts'
import {
  recalculateProfessionalRating,
  shouldOpenQualityCase,
  type ReviewScore
} from '../reviews/recalculate-rating.ts'

export type ReviewCloseoutInput = ReviewCommandInput & {
  previousRatingAvg: number | null
  previousJobsCompleted: number
  previousReviewsCount?: number
  score: ReviewScore
}

export function submitReviewCloseout(input: ReviewCloseoutInput) {
  assertCanReviewJob(input)
  const command = createReviewCommand(input)
  const rating = recalculateProfessionalRating({
    ratingAvg: input.previousRatingAvg,
    reviewsCount: input.previousReviewsCount ?? 0,
    newScore: input.score
  })
  return {
    command,
    rating,
    jobsCompleted: input.previousJobsCompleted,
    openQualityCase: shouldOpenQualityCase(input.score),
    nextActions: shouldOpenQualityCase(input.score)
      ? ['notify_admin_quality', 'freeze_auto_rating_boost']
      : ['thank_customer', 'update_professional_score']
  }
}
