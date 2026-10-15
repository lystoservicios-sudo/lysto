import { describe, expect, it } from 'vitest'
import { calculateServiceQuote, defaultQuotePolicy } from '@/lib/pricing/service-quote'

const id = '10000000-0000-4000-8000-000000000001'
const now = new Date('2026-10-13T12:00:00Z')
const policy = { ...defaultQuotePolicy, approvedUntil: '2026-12-31', platformFeeRate: 0.15, paymentCostRate: 0.04 }
const input = {
  issue: 'no_enfria' as const, urgency: 'flexible' as const, propertyType: 'house' as const,
  access: {}, equipment: { capacity: 4500, technology: 'conventional' as const },
  materials: [], materialsConfirmed: false,
  route: { source: 'google' as const, origin: 'Base verificada del profesional', destination: 'Domicilio del cliente', province: 'CABA' as const,
    outboundKm: 2, returnKm: 2, outboundMinutes: 10, returnMinutes: 10, tolls: 0, tollsVerified: true, measuredAt: now.toISOString() }
}
const scope = { scenario: 'leak' as const, label: 'Mano de obra inicial estimada para la falla informada',
  durationMinutes: 120, travelBufferMinutes: 30, initialLaborOnly: true as const,
  excludesUnpricedParts: true as const, allowsPredictedRepair: true }
const command = { equipmentId: id, expectedEquipmentVersion: 1, addressId: id,
  issue: 'no_enfria', timeSince: 'days', preferredDate: '2026-10-15', timeWindow: '10:00 – 12:00', urgency: 'flexible', uploadIntentIds: [] }

async function contracts() {
  const loaded = await import('@/lib/customer-requests/contracts').catch(() => null)
  expect(loaded, 'The dedicated customer request contract must exist').not.toBeNull()
  return loaded!
}
async function quoteModule() {
  const loaded = await import('@/lib/customer-requests/quote').catch(() => null)
  expect(loaded, 'The scoped initial-labor calculator must exist').not.toBeNull()
  return loaded!
}

describe('Pedir trusted customer contract', () => {
  it('accepts only inventory IDs and details, never a client price or seller', async () => {
    const { requestPreviewInputSchema } = await contracts()
    expect(requestPreviewInputSchema.safeParse(command).success).toBe(true)
    for (const forged of [{ total: 1 }, { professionalId: id }, { materialsConfirmed: true }, { route: input.route }, { marketplaceFee: 0 }])
      expect(requestPreviewInputSchema.safeParse({ ...command, ...forged }).success).toBe(false)
  })
  it('requires coherent home/floor/room identities and versions', async () => {
    const { requestPreviewInputSchema } = await contracts()
    expect(requestPreviewInputSchema.safeParse({ ...command, roomId: id }).success).toBe(false)
    expect(requestPreviewInputSchema.safeParse({ ...command, homeId: id }).success).toBe(false)
    expect(requestPreviewInputSchema.safeParse({ ...command, homeId: id, expectedHomeVersion: 1, floorId: id, roomId: id }).success).toBe(true)
  })
  it('requires a UUID idempotency command and forbids client financial acceptance flags', async () => {
    const { requestPrepareInputSchema } = await contracts()
    expect(requestPrepareInputSchema.safeParse({ previewId: id, commandId: id }).success).toBe(true)
    expect(requestPrepareInputSchema.safeParse({ previewId: id }).success).toBe(false)
    expect(requestPrepareInputSchema.safeParse({ previewId: id, commandId: id, acceptedAt: now.toISOString() }).success).toBe(false)
  })
  it('rejects duplicate upload IDs and oversized descriptions', async () => {
    const { requestPreviewInputSchema } = await contracts()
    expect(requestPreviewInputSchema.safeParse({ ...command, uploadIntentIds: [id, id] }).success).toBe(false)
    expect(requestPreviewInputSchema.safeParse({ ...command, description: 'x'.repeat(2001) }).success).toBe(false)
  })
  it('keeps system-owned answer keys separate from free customer answers', async () => {
    const { requestPreviewInputSchema } = await contracts()
    expect(requestPreviewInputSchema.safeParse({ ...command, answers: { customer_description: 'Overwrite' } }).success).toBe(false)
  })
})

describe('Pedir explicit initial labor scope', () => {
  it('makes the approved labor scope payable without pretending parts or diagnosis were confirmed', async () => {
    const { calculateInitialLaborQuote } = await quoteModule()
    const legacy = calculateServiceQuote(input, policy, now)
    expect(legacy.reviewReasons).toContain('diagnosis_required')
    expect(legacy.reviewReasons).toContain('materials_unconfirmed')
    const quote = calculateInitialLaborQuote(input, policy, scope, now)
    expect(quote.readyToOffer).toBe(true)
    expect(quote.total).toBe(legacy.total)
    expect(quote.platformFee).toBe(legacy.platformFee)
    expect(quote.materials).toEqual([])
    expect(quote.exclusions).toContain('Materiales y repuestos sin cotizar')
    expect(quote.scope).toBe(scope.label)
    expect(quote.contractScope).toBe('initial_labor')
    expect(input.materialsConfirmed).toBe(false)
  })
  it('never makes an unapproved or expired tariff payable', async () => {
    const { calculateInitialLaborQuote } = await quoteModule()
    expect(calculateInitialLaborQuote(input, { ...policy, approvedUntil: null }, scope, now).readyToOffer).toBe(false)
    expect(calculateInitialLaborQuote(input, { ...policy, approvedUntil: '2026-10-12' }, scope, now).reviewReasons).toContain('tariffs_unapproved')
  })
  it('offers the approved 18 percent gross split even when the stored policy retains a legacy provider rate', async () => {
    const { calculateInitialLaborQuote } = await quoteModule()
    const legacyPolicy = { ...policy, platformFeeRate: 0.18, paymentCostRate: 0.06 }
    const grossQuote = calculateInitialLaborQuote(input, { ...legacyPolicy, paymentCostRate: 0 }, scope, now)
    const quote = calculateInitialLaborQuote(input, legacyPolicy, scope, now)
    expect(quote.readyToOffer).toBe(true)
    expect(quote.paymentCostBudget).toBe(0)
    expect(quote.reviewReasons).toEqual([])
    expect(quote.total).toBe(grossQuote.total)
    expect(quote.platformFee).toBe(grossQuote.platformFee)
    expect(quote.professionalAmount).toBe(grossQuote.professionalAmount)
    expect(quote.professionalAmount + quote.platformFee).toBe(quote.total)
    expect(legacyPolicy.paymentCostRate).toBe(0.06)
  })
  it('keeps the gross cost floor, unknown equipment, tolls and special access as blockers', async () => {
    const { calculateInitialLaborQuote } = await quoteModule()
    expect(() => calculateInitialLaborQuote(input, { ...policy, platformFeeRate: 0.3 }, scope, now)).toThrow('professional_cost_floor')
    expect(calculateInitialLaborQuote({ ...input, equipment: { capacity: 4500, technology: 'unknown' } }, policy, scope, now).reviewReasons).toContain('equipment_unknown')
    expect(calculateInitialLaborQuote({ ...input, access: { outdoorUnitAtHeight: true } }, policy, scope, now).reviewReasons).toContain('specialist_access')
    expect(calculateInitialLaborQuote({ ...input, route: { ...input.route, tollsVerified: false } }, policy, scope, now).reviewReasons).toContain('tolls_unverified')
  })
  it('requires an explicitly approved predicted-repair scope rather than a invented diagnostic tariff', async () => {
    const { calculateInitialLaborQuote } = await quoteModule()
    expect(() => calculateInitialLaborQuote(input, policy, { ...scope, allowsPredictedRepair: false }, now)).toThrow('initial_scope_unavailable')
    expect(() => calculateInitialLaborQuote(input, policy, { ...scope, scenario: 'installation' }, now)).toThrow('scenario_not_applicable')
  })
  it('does not clamp a large air conditioner into a smaller price bucket', async () => {
    const { calculateInitialLaborQuote } = await quoteModule()
    expect(() => calculateInitialLaborQuote({ ...input, equipment: { ...input.equipment, capacity: 24000 } }, policy, scope, now)).toThrow()
  })
})
