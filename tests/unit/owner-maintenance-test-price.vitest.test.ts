import { describe, expect, it } from 'vitest'
import {
  applyOwnerMaintenanceTestPrice,
  isOwnerMaintenanceTestCustomer
} from '@/lib/pricing/owner-maintenance-test-price'

const quote = {
  total: 223600,
  platformFee: 40248,
  professionalAmount: 183352,
  platformFeeRate: 0.18,
  platformContribution: 40248,
  paymentCostBudget: 13416,
  calculatorSubtotal: 172000,
  labor: 140000,
  laborReference: 140000,
  adjustments: [],
  materialsAmount: 0,
  travel: 32000,
  safetyAmount: 51600,
  safetyRate: 0.3,
  reviewReasons: ['tariffs_unapproved', 'professional_net_floor'],
  readyToOffer: false,
  specialPricing: null as null | { kind: string; amount: number }
}

describe('owner maintenance test price', () => {
  it('only recognizes the exact customer email and maintenance issue', () => {
    expect(isOwnerMaintenanceTestCustomer('quimey_boca@hotmail.com', 'mantenimiento')).toBe(true)
    expect(isOwnerMaintenanceTestCustomer('quimey_boca@hotmail.com', 'no_enfria')).toBe(false)
    expect(isOwnerMaintenanceTestCustomer('other@hotmail.com', 'mantenimiento')).toBe(false)
  })

  it('sets only the owner maintenance test quote to ARS 1,000 and retains the 18/82 split', () => {
    const result = applyOwnerMaintenanceTestPrice(quote, true)
    expect(result.total).toBe(1000)
    expect(result.platformFee).toBe(180)
    expect(result.professionalAmount).toBe(820)
    expect(result.platformFeeRate).toBe(0.18)
    expect(result.platformContribution).toBe(180)
    expect(result.specialPricing).toEqual({ kind: 'owner_maintenance_test', amount: 1000 })
    expect(result.reviewReasons).not.toContain('tariffs_unapproved')
    expect(result.reviewReasons).toContain('owner_maintenance_test_review')
    expect(result.readyToOffer).toBe(false)
  })

  it('leaves every other quote unchanged', () => {
    expect(applyOwnerMaintenanceTestPrice(quote, false)).toEqual(quote)
  })
})
