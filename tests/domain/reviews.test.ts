import { test, expect } from '../_lib/test.ts'
import { submitReview } from '../../lib/reviews/review.ts'

test('solo trabajos completos aceptan review', () => {
  expect(() => submitReview({ jobStatus: 'in_progress', alreadyReviewed: false, serviceRating: 5, professionalRating: 5 })).toThrow()
})

test('review positiva suma score y tags', () => {
  const result = submitReview({ jobStatus: 'completed', alreadyReviewed: false, serviceRating: 5, professionalRating: 4, problemResolved: true, wouldHireAgain: true })
  expect(result.averageRating).toBe(4.5)
  expect(result.scoreDelta).toBe(4)
  expect(result.tags.includes('positive_signal')).toBeTruthy()
})

test('review baja genera alerta calidad', () => {
  const result = submitReview({ jobStatus: 'completed', alreadyReviewed: false, serviceRating: 2, professionalRating: 2, problemResolved: false })
  expect(result.scoreDelta).toBe(-8)
  expect(result.tags.includes('quality_alert')).toBeTruthy()
})
