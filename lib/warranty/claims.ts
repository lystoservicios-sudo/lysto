export type WarrantyClaimInput = {
  jobId: string
  customerId: string
  completedAt: string
  warrantyDays: number
  claimDate: string
  description: string
  sameProblem: boolean
}

export type WarrantyClaimDecision = {
  acceptedForReview: boolean
  status: 'open' | 'rejected'
  reason?: string
  daysSinceCompletion: number
}

export function evaluateWarrantyClaim(input: WarrantyClaimInput): WarrantyClaimDecision {
  if (!input.jobId.trim()) throw new Error('job_id_required')
  if (!input.customerId.trim()) throw new Error('customer_id_required')
  if (!input.description.trim()) throw new Error('description_required')
  const completed = new Date(input.completedAt)
  const claim = new Date(input.claimDate)
  const diff = Math.floor((claim.getTime() - completed.getTime()) / 86_400_000)
  if (Number.isNaN(diff)) throw new Error('invalid_dates')
  if (diff < 0) return { acceptedForReview: false, status: 'rejected', reason: 'claim_before_completion', daysSinceCompletion: diff }
  if (input.warrantyDays <= 0) return { acceptedForReview: false, status: 'rejected', reason: 'job_without_warranty', daysSinceCompletion: diff }
  if (diff > input.warrantyDays) return { acceptedForReview: false, status: 'rejected', reason: 'warranty_expired', daysSinceCompletion: diff }
  if (!input.sameProblem) return { acceptedForReview: false, status: 'rejected', reason: 'different_problem', daysSinceCompletion: diff }
  return { acceptedForReview: true, status: 'open', daysSinceCompletion: diff }
}
