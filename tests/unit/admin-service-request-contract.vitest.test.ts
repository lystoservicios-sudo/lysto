import { describe, expect, it } from 'vitest'
import { adminRequestSchema, calculateAdminRequestAmounts } from '@/lib/admin/service-request-contract'

const input = {
  id: '00000000-0000-4000-8000-000000000001', expectedVersion: 0,
  customerId: '00000000-0000-4000-8000-000000000002',
  addressId: '00000000-0000-4000-8000-000000000003',
  categoryId: '00000000-0000-4000-8000-000000000004',
  issueTypeId: '00000000-0000-4000-8000-000000000005',
  professionalId: '00000000-0000-4000-8000-000000000006',
  serviceTitle: 'Mantenimiento completo', description: 'Limpieza de ambas unidades y prueba de funcionamiento.',
  startsAt: '2027-01-10T10:00:00-03:00', durationMinutes: 60, travelBufferMinutes: 15,
  total: 100000, commission: { mode: 'percentage', value: 20 }, action: 'draft'
}

describe('administrative request contract', () => {
  it('allows an incomplete equipment choice in drafts but never sends an unfulfillable service', () => {
    expect(adminRequestSchema.safeParse({ ...input, equipmentId: null }).success).toBe(true)
    expect(adminRequestSchema.safeParse({ ...input, action: 'send', equipmentId: null }).success).toBe(false)
  })
  it('splits the agreed total without adding the commission to the customer price', () => {
    expect(calculateAdminRequestAmounts(100000, { mode: 'percentage', value: 20 }, 0.06))
      .toEqual({ total: 100000, platformFee: 20000, professionalAmount: 80000, paymentCostBudget: 6000, professionalNetEstimate: 74000 })
  })
  it('supports a fixed commission and rounds percentages to cents', () => {
    expect(calculateAdminRequestAmounts(100.05, { mode: 'percentage', value: 17.5 }).platformFee).toBe(17.51)
    expect(calculateAdminRequestAmounts(100.05, { mode: 'amount', value: 10.01 }).professionalAmount).toBe(90.04)
  })
  it.each([
    [100, { mode: 'amount', value: 101 }], [100, { mode: 'percentage', value: 100 }],
    [-1, { mode: 'amount', value: 0 }], [100, { mode: 'percentage', value: -1 }],
    [100.001, { mode: 'amount', value: 0 }], [NaN, { mode: 'amount', value: 0 }]
  ])('rejects invalid or exhausted splits', (total, commission) => {
    expect(() => calculateAdminRequestAmounts(total as number, commission as { mode: 'amount'; value: number })).toThrow()
  })
  it('allows zero platform commission', () => {
    expect(calculateAdminRequestAmounts(100, { mode: 'amount', value: 0 }).professionalAmount).toBe(100)
  })
  it('requires explicit scope, real identifiers, version and no client-derived financial fields', () => {
    expect(adminRequestSchema.safeParse(input).success).toBe(true)
    expect(adminRequestSchema.safeParse({ ...input, description: 'ok' }).success).toBe(false)
    expect(adminRequestSchema.safeParse({ ...input, platformFee: 10 }).success).toBe(false)
    expect(adminRequestSchema.safeParse({ ...input, expectedVersion: -1 }).success).toBe(false)
    expect(adminRequestSchema.safeParse({ ...input, commission: { mode: 'amount', value: 100001 } }).success).toBe(false)
  })
})
