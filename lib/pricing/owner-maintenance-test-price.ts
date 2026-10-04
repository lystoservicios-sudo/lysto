import { money } from './decimal-money'

export const OWNER_TEST_CUSTOMER_EMAIL = 'quimey_boca@hotmail.com'
export const OWNER_MAINTENANCE_TEST_PRICE = 1000
export const MARKETPLACE_COMMISSION_RATE = 0.18

export function isOwnerMaintenanceTestCustomer(email: string | null | undefined, issue: string) {
  return email?.trim().toLowerCase() === OWNER_TEST_CUSTOMER_EMAIL && issue === 'mantenimiento'
}

export function isOwnerMaintenanceTestIssue(ownerTestCustomer: boolean, issue: string) {
  return ownerTestCustomer && issue === 'mantenimiento'
}

export function confirmNoMaterialsForOwnerTest<T extends { materialsConfirmed: boolean }>(
  input: T,
  ownerTestQuote: boolean
): T {
  return ownerTestQuote ? { ...input, materialsConfirmed: true } : input
}

type QuoteAmounts = {
  total: number
  platformFee: number
  professionalAmount: number
  platformFeeRate: number
  platformContribution: number
  paymentCostBudget: number
  calculatorSubtotal: number
  labor: number
  laborReference: number
  adjustments: unknown[]
  materialsAmount: number
  travel: number
  safetyAmount: number
  reviewReasons: string[]
  readyToOffer: boolean
  specialPricing?: { kind: string; amount: number } | null
}

export function applyOwnerMaintenanceTestPrice<T extends QuoteAmounts>(quote: T, eligible: boolean) {
  if (!eligible) return quote
  const platformFee = money(OWNER_MAINTENANCE_TEST_PRICE * MARKETPLACE_COMMISSION_RATE)
  const professionalAmount = money(OWNER_MAINTENANCE_TEST_PRICE - platformFee)
  const reviewReasons = quote.reviewReasons.filter(
    (reason) => reason !== 'tariffs_unapproved' && reason !== 'professional_net_floor'
  )
  reviewReasons.push('owner_maintenance_test_review')
  return {
    ...quote,
    total: OWNER_MAINTENANCE_TEST_PRICE,
    platformFee,
    professionalAmount,
    platformFeeRate: MARKETPLACE_COMMISSION_RATE,
    platformContribution: platformFee,
    paymentCostBudget: money(OWNER_MAINTENANCE_TEST_PRICE * 0.06),
    calculatorSubtotal: OWNER_MAINTENANCE_TEST_PRICE,
    labor: OWNER_MAINTENANCE_TEST_PRICE,
    laborReference: OWNER_MAINTENANCE_TEST_PRICE,
    adjustments: [],
    materialsAmount: 0,
    travel: 0,
    safetyAmount: 0,
    reviewReasons,
    readyToOffer: false,
    specialPricing: { kind: 'owner_maintenance_test' as const, amount: OWNER_MAINTENANCE_TEST_PRICE }
  }
}

export function previewOwnerMaintenanceTestPrice<T extends QuoteAmounts>(
  quote: T,
  ownerTestCustomer: boolean,
  issue: string
) {
  return applyOwnerMaintenanceTestPrice(
    quote,
    isOwnerMaintenanceTestIssue(ownerTestCustomer, issue)
  )
}
