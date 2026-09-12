import { describe, expect, it } from 'vitest'
import {
  calculateServiceQuote,
  defaultQuotePolicy,
  money,
  referenceCatalog,
  scenarioCodes,
  type QuoteInput
} from '@/lib/pricing/service-quote'

const now = new Date('2026-09-10T15:00:00Z')
const route = {
  source: 'google' as const,
  origin: 'Obelisco, CABA',
  destination: 'Av. Corrientes 1240, CABA',
  province: 'CABA' as const,
  outboundKm: 10,
  returnKm: 10,
  outboundMinutes: 30,
  returnMinutes: 30,
  tolls: 0,
  tollsVerified: true,
  measuredAt: now.toISOString()
}
const input: QuoteInput = {
  issue: 'mantenimiento',
  timeSince: 'days',
  urgency: 'flexible',
  propertyType: 'apartment',
  access: { hasParking: true },
  equipment: { capacity: 3000, technology: 'conventional' },
  route,
  materials: [],
  materialsConfirmed: true
}
const policy = { ...defaultQuotePolicy, approvedUntil: '2026-10-01', paymentCostRate: 0.06 }

describe('service proposals', () => {
  it('compares professional cost coverage in cents at the exact boundary', () => {
    const q = calculateServiceQuote(
      {
        ...input,
        route: { ...route, outboundKm: 0, returnKm: 0, outboundMinutes: 0, returnMinutes: 0 }
      },
      {
        ...policy,
        laborOverrides: { maintenance: 100.15 },
        minimumTravel: 0,
        platformFeeRate: 0.2,
        paymentCostRate: 3 / 13 - 0.2
      },
      now
    )
    expect(q.professionalAmount).toBe(104.16)
    expect(q.paymentCostBudget).toBe(4.01)
    expect(q.reviewReasons).not.toContain('professional_net_floor')
  })
  it('keeps tariff validity through the approved Buenos Aires calendar day', () => {
    const at = new Date('2026-10-02T01:00:00Z')
    const q = calculateServiceQuote(
      { ...input, route: { ...route, measuredAt: at.toISOString() } },
      { ...policy, approvedUntil: '2026-10-01' },
      at
    )
    expect(q.reviewReasons).not.toContain('tariffs_unapproved')
  })
  it('rounds decimal half cents the same way as PostgreSQL NUMERIC', () => {
    expect(money(10.075)).toBe(10.08)
    const q = calculateServiceQuote(
      {
        ...input,
        materials: [{ description: 'Material fraccionado', unitPrice: 20.15, quantity: 0.5 }]
      },
      policy,
      now
    )
    expect(q.materialsAmount).toBe(10.08)
  })
  it('rejects prices with fractions below the currency cent', () => {
    expect(() =>
      calculateServiceQuote(
        {
          ...input,
          materials: [{ description: 'Precio inválido', unitPrice: 10.001, quantity: 1 }]
        },
        policy,
        now
      )
    ).toThrow()
  })
  it('adds exactly 30% once, retaining the original 18% split without underpaying the calculated work', () => {
    const q = calculateServiceQuote(input, policy, now)
    expect(q.labor).toBe(140000)
    expect(q.travel).toBe(32000)
    expect(q.calculatorSubtotal).toBe(172000)
    expect(q.safetyAmount).toBe(51600)
    expect(q.total).toBe(223600)
    expect(q.professionalAmount + q.platformFee).toBe(q.total)
    expect(q.professionalAmount).toBeGreaterThanOrEqual(q.calculatorSubtotal)
    expect(q.platformContribution).toBe(40248)
    expect(q.reviewReasons).toEqual(['professional_net_floor'])
  })
  it('never silently treats missing routing, unpriced materials or expired tariffs as ready', () => {
    const q = calculateServiceQuote(
      { ...input, route: undefined, materialsConfirmed: false },
      defaultQuotePolicy,
      now
    )
    expect(q.reviewReasons).toEqual(
      expect.arrayContaining(['travel_unverified', 'materials_unconfirmed', 'tariffs_unapproved'])
    )
    expect(q.readyToOffer).toBe(false)
  })
  it('enforces Buenos Aires coverage and 180 minute outbound boundary', () => {
    expect(
      calculateServiceQuote({ ...input, route: { ...route, outboundMinutes: 180 } }, policy, now)
        .coverage
    ).toBe('covered')
    expect(
      calculateServiceQuote({ ...input, route: { ...route, outboundMinutes: 180.01 } }, policy, now)
        .coverage
    ).toBe('outside')
    expect(
      calculateServiceQuote({ ...input, route: { ...route, province: 'other' } }, policy, now)
        .readyToOffer
    ).toBe(false)
  })
  it('prices installation by capacity and does not invent a compressor price', () => {
    const q = calculateServiceQuote(
      { ...input, issue: 'instalacion', equipment: { capacity: 6000, technology: 'conventional' } },
      policy,
      now
    )
    expect(q.labor).toBe(260000)
    expect(() =>
      calculateServiceQuote({ ...input, issue: 'no_enfria', scenario: 'compressor' }, policy, now)
    ).toThrow('manual_quote_required')
    expect(referenceCatalog.compressor.maximum).toBeNull()
  })
  it('includes material quantities and rounds monetary amounts without losing cents', () => {
    const q = calculateServiceQuote(
      { ...input, materials: [{ description: 'Caño', unitPrice: 12000.25, quantity: 2.5 }] },
      policy,
      now
    )
    expect(q.materialsAmount).toBe(30000.63)
    expect(q.total).toBe(262600.82)
    expect(Number((q.platformFee + q.professionalAmount).toFixed(2))).toBe(q.total)
  })
  it.each([NaN, Infinity, -1])('rejects invalid material prices %s', (unitPrice) => {
    expect(() =>
      calculateServiceQuote(
        { ...input, materials: [{ description: 'Repuesto', unitPrice, quantity: 1 }] },
        policy,
        now
      )
    ).toThrow()
  })
  it('blocks a commission configuration that cannot pay the professional cost floor', () => {
    expect(() => calculateServiceQuote(input, { ...policy, platformFeeRate: 0.3 }, now)).toThrow(
      'professional_cost_floor'
    )
  })
  it('does not interpret diagnostic scores or duration as statistical repair probabilities', () => {
    expect(calculateServiceQuote({ ...input, timeSince: 'months' }, policy, now).total).toBe(
      calculateServiceQuote({ ...input, timeSince: 'today' }, policy, now).total
    )
  })
  it('requires review for simulation routes, stale routes and unknown installation equipment', () => {
    expect(
      calculateServiceQuote({ ...input, route: { ...route, source: 'simulation' } }, policy, now)
        .readyToOffer
    ).toBe(false)
    expect(
      calculateServiceQuote(
        { ...input, route: { ...route, measuredAt: '2020-01-01T00:00:00Z' } },
        policy,
        now
      ).reviewReasons
    ).toContain('travel_stale')
    expect(
      calculateServiceQuote({ ...input, issue: 'instalacion', equipment: undefined }, policy, now)
        .reviewReasons
    ).toContain('equipment_unknown')
  })
  it('covers all seven user issues with scopes and exclusions', () => {
    expect(Object.keys(scenarioCodes)).toHaveLength(7)
    for (const issue of Object.keys(scenarioCodes) as QuoteInput['issue'][]) {
      const q = calculateServiceQuote({ ...input, issue }, policy, now)
      expect(q.total).toBeGreaterThan(0)
      expect(q.scope.length).toBeGreaterThan(10)
      expect(q.exclusions.length).toBeGreaterThan(0)
      expect(q.safetyRate).toBe(0.3)
    }
  })
  it('uses an explicitly updated tariff without rewriting the reference source', () => {
    const q = calculateServiceQuote(
      input,
      { ...policy, laborOverrides: { maintenance: 180000 } },
      now
    )
    expect(q.labor).toBe(180000)
    expect(referenceCatalog.maintenance.minimum).toBe(140000)
  })
})
