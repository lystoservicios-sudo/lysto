import type { ServiceIssueSlug } from '../domain/types.ts'

export type PricingRuleUpdateInput = {
  categorySlug: string
  issue?: ServiceIssueSlug
  zoneSlug: string
  basePrice: number
  issueAdjustment: number
  priorityMultiplier: number
  platformFeeRate: number
  adminProfileId?: string
}

export type PricingRuleUpdateResult = {
  ok: true
  normalized: PricingRuleUpdateInput
  auditAction: 'pricing_rule_updated'
  affectedFutureRequestsOnly: true
} | { ok: false; errors: string[] }

export function validatePricingRuleUpdate(input: PricingRuleUpdateInput): PricingRuleUpdateResult {
  const errors: string[] = []
  if (!input.adminProfileId) errors.push('admin_required')
  if (!input.categorySlug.trim()) errors.push('category_required')
  if (!input.zoneSlug.trim()) errors.push('zone_required')
  if (!Number.isFinite(input.basePrice) || input.basePrice < 0) errors.push('invalid_base_price')
  if (!Number.isFinite(input.issueAdjustment) || input.issueAdjustment < -input.basePrice) errors.push('invalid_issue_adjustment')
  if (!Number.isFinite(input.priorityMultiplier) || input.priorityMultiplier < 1 || input.priorityMultiplier > 3) errors.push('invalid_priority_multiplier')
  if (!Number.isFinite(input.platformFeeRate) || input.platformFeeRate < 0 || input.platformFeeRate > 0.6) errors.push('invalid_platform_fee_rate')
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    normalized: {
      ...input,
      categorySlug: input.categorySlug.trim(),
      zoneSlug: input.zoneSlug.trim(),
      basePrice: Math.round(input.basePrice),
      issueAdjustment: Math.round(input.issueAdjustment),
      priorityMultiplier: Number(input.priorityMultiplier.toFixed(3)),
      platformFeeRate: Number(input.platformFeeRate.toFixed(3))
    },
    auditAction: 'pricing_rule_updated',
    affectedFutureRequestsOnly: true
  }
}
