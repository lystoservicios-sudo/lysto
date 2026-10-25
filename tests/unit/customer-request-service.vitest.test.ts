import { describe, expect, it, vi } from 'vitest'
import type { Session } from '@/lib/auth/session'
import { defaultQuotePolicy } from '@/lib/pricing/service-quote'
import { createCustomerRequestService } from '@/lib/customer-requests/service'

const customerId = '20000000-0000-4000-8000-000000000001'
const userId = '20000000-0000-4000-8000-000000000002'
const sessionId = '20000000-0000-4000-8000-000000000003'
const equipmentId = '20000000-0000-4000-8000-000000000004'
const policyId = '20000000-0000-4000-8000-000000000005'
const quotePolicyId = '20000000-0000-4000-8000-000000000006'
const professionalId = '20000000-0000-4000-8000-000000000007'
const previewId = '20000000-0000-4000-8000-000000000008'
const now = new Date('2026-10-13T12:00:00Z')
const scope = { scenario: 'leak', label: 'Mano de obra inicial estimada para la falla informada', durationMinutes: 120,
  travelBufferMinutes: 30, initialLaborOnly: true, excludesUnpricedParts: true, allowsPredictedRepair: true, allowCustomerEquipmentDeclaration: false }
const input = { equipmentId, expectedEquipmentVersion: 1, addressId: equipmentId,
  issue: 'no_enfria', preferredDate: '2026-10-15', timeWindow: '10:00 – 12:00', urgency: 'flexible' }
const context = () => ({ context: {
  address: { id: equipmentId, street: 'Visita', number: '20', city: 'CABA', province: 'CABA', propertyType: 'house', access: {} },
  equipment: { id: equipmentId, version: 1, nickname: 'Aire living', capacity: 4500, technology: 'conventional', declarationUsed: false },
  home: null, floor: null, room: null, placement: null },
  policy: { id: policyId, quotePolicyId, approvedUntil: '2026-12-31T23:59:00Z', scope },
  quotePolicy: { id: quotePolicyId, policy: { ...defaultQuotePolicy, approvedUntil: '2026-12-31', platformFeeRate: 0.15, paymentCostRate: 0.04 } },
  candidates: [{ professionalId, origin: 'Domicilio privado exacto del técnico', sellerAccountId: 'seller-actual' }], reason: null })
const actor = { role: 'customer', customerId, userId, sessionId } as Session
function dependencies(value = context()) {
  const saved: Record<string, unknown>[] = []
  const write = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === 'read_customer_request_context') return { data: value, error: null }
    if (name === 'persist_customer_request_preview') {
      const payload = args.p_payload as Record<string, unknown>
      saved.push(payload)
      return { data: { status: 'ready', previewId, quote: payload.quote, scope: scope.label, exclusions: ['Materiales y repuestos sin cotizar'], expiresAt: payload.expiresAt }, error: null }
    }
    return { data: null, error: { code: 'XX000' } }
  })
  const travel = vi.fn(async () => ({ source: 'google' as const, origin: 'Domicilio privado exacto del técnico', destination: 'Visita 20',
    province: 'CABA' as const, outboundKm: 3, returnKm: 4, outboundMinutes: 12, returnMinutes: 14,
    tolls: 0, tollsVerified: true, measuredAt: now.toISOString() }))
  const seller = vi.fn(async () => undefined)
  return { write, travel, seller, mode: () => false, now: () => now, saved }
}

describe('Pedir server preparation boundary', () => {
  it('quotes complete customer-declared equipment when the active scope permits it', async () => {
    const value = context()
    value.context.equipment.declarationUsed = true
    value.policy.scope = { ...scope, allowCustomerEquipmentDeclaration: true }
    const deps = dependencies(value)
    const result = await createCustomerRequestService(deps).preview(actor, {
      ...input, equipmentDeclaration: { capacity: 4500, technology: 'conventional' }
    })
    expect(result.status).toBe('ready')
    expect(result.quote?.total).toBeGreaterThan(0)
    expect(result.quote?.readyToOffer).toBe(true)
    expect(deps.saved).toHaveLength(1)
  })
  it('preserves the policy boundary when declarations have not been approved', async () => {
    const value = context()
    value.context.equipment.declarationUsed = true
    const deps = dependencies(value)
    const result = await createCustomerRequestService(deps).preview(actor, input)
    expect(result).toMatchObject({ status: 'needs_review', reason: 'equipment_declaration_requires_review' })
    expect(deps.saved).toHaveLength(0)
    expect(deps.travel).not.toHaveBeenCalled()
  })
  it('uses the chosen eligible technician origin and persists only trusted calculator money', async () => {
    const deps = dependencies()
    const result = await createCustomerRequestService(deps).preview(actor, input)
    expect(result.status).toBe('ready')
    expect(result.quote?.total).toBeGreaterThan(0)
    expect(deps.travel).toHaveBeenCalledWith(expect.objectContaining({ origin: 'Domicilio privado exacto del técnico', address: 'Visita 20, CABA, CABA, Argentina', visitDurationMinutes: 120 }))
    expect(deps.write).toHaveBeenCalledWith('read_customer_request_context', expect.objectContaining({ p_actor_user_id: userId, p_actor_session_id: sessionId, p_customer_id: customerId }))
    expect(deps.saved[0].quotePolicyId).toBe(quotePolicyId)
    expect(deps.saved[0].professionalId).toBe(professionalId)
  })
  it('never exposes a technician private base address in a response or public quote snapshot', async () => {
    const deps = dependencies()
    const result = await createCustomerRequestService(deps).preview(actor, input)
    expect(JSON.stringify(result)).not.toContain('Domicilio privado exacto')
    const payload = deps.saved[0]
    expect(JSON.stringify(payload.quote)).not.toContain('Domicilio privado exacto')
    expect(JSON.stringify(payload.calculatedInput)).not.toContain('Domicilio privado exacto')
    expect(payload.origin).toBe('Domicilio privado exacto del técnico')
  })
  it('prepares an 18 percent gross quote without blocking on a legacy assumed provider commission', async () => {
    const value = context()
    value.quotePolicy.policy.platformFeeRate = 0.18
    value.quotePolicy.policy.paymentCostRate = 0.06
    const deps = dependencies(value)
    const result = await createCustomerRequestService(deps).preview(actor, input)
    expect(result.status).toBe('ready')
    expect(result.quote?.paymentCostBudget).toBe(0)
    expect(result.quote?.reviewReasons).toEqual([])
    expect(result.quote?.total).toBe((result.quote?.platformFee ?? 0) + (result.quote?.professionalAmount ?? 0))
    expect(deps.saved).toHaveLength(1)
    expect(value.quotePolicy.policy.paymentCostRate).toBe(0.06)
  })
  it('reports a gross professional cost floor without mislabeling it as a provider net fee', async () => {
    const value = context()
    value.quotePolicy.policy.platformFeeRate = 0.3
    const deps = dependencies(value)
    const result = await createCustomerRequestService(deps).preview(actor, input)
    expect(result).toMatchObject({ status: 'needs_review', reason: 'professional_cost_floor' })
    expect(deps.saved).toHaveLength(0)
  })
  it('does not reserve capacity or create a job while previewing', async () => {
    const deps = dependencies()
    await createCustomerRequestService(deps).preview(actor, input)
    expect(deps.write.mock.calls.map(call => call[0])).toEqual(['read_customer_request_context', 'persist_customer_request_preview'])
  })
  it('fails closed for an unavailable policy without calling routing or a payment provider', async () => {
    const value = context()
    value.reason = 'tariffs_unapproved' as never
    const deps = dependencies(value)
    const result = await createCustomerRequestService(deps).preview(actor, input)
    expect(result).toMatchObject({ status: 'needs_review', reason: 'tariffs_unapproved' })
    expect(result.previewId).toBeUndefined()
    expect(deps.travel).not.toHaveBeenCalled()
    expect(deps.seller).not.toHaveBeenCalled()
  })
  it('does not pretend a travel outage or incompatible seller means a ready price', async () => {
    const deps = dependencies()
    deps.travel.mockRejectedValueOnce(new Error('route_unavailable'))
    expect(await createCustomerRequestService(deps).preview(actor, input)).toMatchObject({ status: 'needs_review', reason: 'travel_unverified' })
    expect(deps.saved).toHaveLength(0)
    const paymentDeps = dependencies()
    paymentDeps.seller.mockRejectedValueOnce(new Error('payment_mode_mismatch'))
    expect(await createCustomerRequestService(paymentDeps).preview(actor, input)).toMatchObject({ status: 'unavailable', reason: 'payment_mode_mismatch' })
    expect(paymentDeps.saved).toHaveLength(0)
  })
  it('requires actual seller preflight even when SQL preselected a refreshable linked account', async () => {
    const deps = dependencies()
    deps.seller.mockRejectedValueOnce(new Error('seller_not_linked'))
    const result = await createCustomerRequestService(deps).preview(actor, input)
    expect(result).toMatchObject({ status: 'unavailable', reason: 'seller_not_linked' })
    expect(result.previewId).toBeUndefined()
    expect(deps.travel).not.toHaveBeenCalled()
    expect(deps.saved).toHaveLength(0)
  })
  it('can use another eligible candidate when the first base is outside the supported routing origin', async () => {
    const value = context()
    value.candidates.push({ professionalId: userId, origin: 'Segunda base de fixture', sellerAccountId: 'second-seller' })
    const deps = dependencies(value)
    deps.travel.mockRejectedValueOnce(new Error('origin_must_be_caba'))
    const result = await createCustomerRequestService(deps).preview(actor, input)
    expect(result.status).toBe('ready')
    expect(deps.saved[0].professionalId).toBe(userId)
    expect(deps.travel).toHaveBeenLastCalledWith(expect.objectContaining({ origin: 'Segunda base de fixture' }))
  })
  it('never turns missing or unknown equipment data into a payable quote', async () => {
    const value = context()
    value.context.equipment.technology = 'unknown'
    const deps = dependencies(value)
    expect(await createCustomerRequestService(deps).preview(actor, input)).toMatchObject({ status: 'needs_review', reason: 'equipment_unknown' })
    expect(deps.saved).toHaveLength(0)
  })
  it('rejects client authority or malformed database responses before contract mutation', async () => {
    const deps = dependencies()
    await expect(createCustomerRequestService(deps).preview({ ...actor, role: 'professional' }, input)).rejects.toMatchObject({ code: 'forbidden' })
    await expect(createCustomerRequestService(deps).preview(actor, { ...input, total: 1 })).rejects.toThrow()
    expect(deps.write).not.toHaveBeenCalled()
    deps.write.mockResolvedValueOnce({ data: {} as never, error: null })
    await expect(createCustomerRequestService(deps).preview(actor, input)).rejects.toMatchObject({ code: 'service_unavailable' })
  })
  it('revalidates the eligible seller before submitting one durable prepare command', async () => {
    const deps = dependencies()
    await createCustomerRequestService(deps).preview(actor, input)
    const payload = deps.saved[0]
    const result = { status: 'ready', jobId: equipmentId, requestId: equipmentId, quoteId: equipmentId,
      quote: payload.quote, expiresAt: '2026-10-13T12:30:00+00:00' }
    deps.write.mockResolvedValueOnce({ data: { result: null, payload } as never, error: null })
    deps.write.mockResolvedValueOnce({ data: result as never, error: null })
    expect(await createCustomerRequestService(deps).prepare(actor, { previewId, commandId: userId })).toEqual(result)
    expect(deps.seller).toHaveBeenLastCalledWith(professionalId, 'seller-actual', false)
    expect(deps.write).toHaveBeenLastCalledWith('prepare_customer_request', expect.objectContaining({ p_preview_id: previewId, p_command_id: userId, p_customer_id: customerId }))
  })
  it('recovers the committed result without repeating routing or provider reads after expiry', async () => {
    const deps = dependencies()
    await createCustomerRequestService(deps).preview(actor, input)
    const result = { status: 'ready', jobId: equipmentId, requestId: equipmentId, quoteId: equipmentId, quote: deps.saved[0].quote }
    deps.seller.mockClear()
    deps.travel.mockClear()
    deps.write.mockResolvedValueOnce({ data: { result, payload: null } as never, error: null })
    expect(await createCustomerRequestService({ ...deps, now: () => new Date('2026-10-20T00:00:00Z') }).prepare(actor, { previewId, commandId: userId })).toEqual(result)
    expect(deps.seller).not.toHaveBeenCalled()
    expect(deps.travel).not.toHaveBeenCalled()
  })
  it('durably binds a new command key when reusing an already committed preview', async () => {
    const deps = dependencies()
    await createCustomerRequestService(deps).preview(actor, input)
    const result = { status: 'ready', jobId: equipmentId, requestId: equipmentId, quoteId: equipmentId, quote: deps.saved[0].quote }
    deps.seller.mockClear()
    deps.write.mockResolvedValueOnce({ data: { result: null, payload: deps.saved[0], committed: true } as never, error: null })
    deps.write.mockResolvedValueOnce({ data: result as never, error: null })
    expect(await createCustomerRequestService({ ...deps, now: () => new Date('2026-10-20T00:00:00Z') }).prepare(actor, { previewId, commandId: userId })).toEqual(result)
    expect(deps.write).toHaveBeenLastCalledWith('prepare_customer_request', expect.objectContaining({ p_command_id: userId, p_preview_id: previewId }))
    expect(deps.seller).not.toHaveBeenCalled()
  })
  it('requires explicit recalculation if an unaccepted preview expires', async () => {
    const deps = dependencies()
    await createCustomerRequestService(deps).preview(actor, input)
    deps.seller.mockClear()
    deps.write.mockResolvedValueOnce({ data: { result: null, payload: deps.saved[0] } as never, error: null })
    const result = await createCustomerRequestService({ ...deps, now: () => new Date('2026-10-14T00:00:00Z') }).prepare(actor, { previewId, commandId: userId })
    expect(result).toMatchObject({ status: 'price_changed', reason: 'quote_expired' })
    expect(deps.seller).not.toHaveBeenCalled()
    expect(deps.write.mock.calls.some(call => call[0] === 'prepare_customer_request')).toBe(false)
  })
  it('preserves a price-changed database result instead of falsely enabling payment', async () => {
    const deps = dependencies()
    await createCustomerRequestService(deps).preview(actor, input)
    deps.write.mockResolvedValueOnce({ data: { result: null, payload: deps.saved[0] } as never, error: null })
    deps.write.mockResolvedValueOnce({ data: { status: 'price_changed', reason: 'context_or_policy_changed' } as never, error: null })
    expect(await createCustomerRequestService(deps).prepare(actor, { previewId, commandId: userId })).toMatchObject({ status: 'price_changed' })
  })
})
