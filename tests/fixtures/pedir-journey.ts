import type { Session } from '@/lib/auth/session'
import type { CustomerHomesSnapshot } from '@/lib/customer-homes/contracts'
import { createCustomerRequestService } from '@/lib/customer-requests/service'
import { previewPayloadSchema, type CustomerRequestResult } from '@/lib/customer-requests/contracts'
import { defaultQuotePolicy } from '@/lib/pricing/service-quote'
import { resolveRequestContext } from '@/features/service-request/request-context'

export const journeyIds = {
  customer: '72000000-0000-4000-8000-000000000001', user: '72000000-0000-4000-8000-000000000002',
  session: '72000000-0000-4000-8000-000000000003', profile: '72000000-0000-4000-8000-000000000004',
  address: '72000000-0000-4000-8000-000000000005', equipment: '72000000-0000-4000-8000-000000000006',
  home: '72000000-0000-4000-8000-000000000007', floor: '72000000-0000-4000-8000-000000000008',
  room: '72000000-0000-4000-8000-000000000009', professional: '72000000-0000-4000-8000-000000000010',
  policy: '72000000-0000-4000-8000-000000000011', quotePolicy: '72000000-0000-4000-8000-000000000012',
  preview: '72000000-0000-4000-8000-000000000013', request: '72000000-0000-4000-8000-000000000014',
  quote: '72000000-0000-4000-8000-000000000015', job: '72000000-0000-4000-8000-000000000016',
  checkout: '72000000-0000-4000-8000-000000000017', command: '72000000-0000-4000-8000-000000000018'
}
export const journeyNow = new Date('2028-01-10T12:00:00Z')
export const journeyActor = { role: 'customer', customerId: journeyIds.customer, userId: journeyIds.user,
  profileId: journeyIds.profile, sessionId: journeyIds.session, assuranceLevel: 'aal1', permissions: [] } as unknown as Session
export const journeyInput = { equipmentId: journeyIds.equipment, expectedEquipmentVersion: 2, addressId: journeyIds.address,
  homeId: journeyIds.home, expectedHomeVersion: 3, floorId: journeyIds.floor, roomId: journeyIds.room,
  issue: 'pierde_agua', timeSince: 'days', preferredDate: '2028-01-13', timeWindow: '10:00 – 12:00', urgency: 'flexible' }

export function journeySnapshot(): CustomerHomesSnapshot {
  return {
    addresses: [{ id: journeyIds.address, label: 'Casa', street: 'Visita', number: '20', city: 'CABA', province: 'CABA', propertyType: 'house', access: {},
      isDefault: true, version: 2, createdAt: journeyNow.toISOString(), archivedAt: null }],
    equipment: [{ id: journeyIds.equipment, nickname: 'Aire del living', addressId: journeyIds.address, equipmentType: 'inverter', brand: null, model: null,
      serialNumber: null, frigorias: '3000', version: 2, createdAt: journeyNow.toISOString(), archivedAt: null }],
    homes: [{ id: journeyIds.home, name: 'Mi casa', addressId: journeyIds.address, kind: 'house', building: null,
      features: { balcony: false, terrace: false, windows: 'small' }, version: 3,
      floors: [{ id: journeyIds.floor, name: 'Nivel principal', order: 0, rooms: [{ id: journeyIds.room, name: 'Living', kind: 'living', variant: 'family', x: 0, z: 0, width: 4, depth: 4, rotation: 0, windows: 'small' }] }],
      placements: [{ equipmentId: journeyIds.equipment, roomId: journeyIds.room, wall: 'north', offset: .5, height: 2 }] }]
  }
}

/** In-memory RPC transport fixture, not a substitute for PostgreSQL policy/lock tests. */
export function journeyService(options: {
  issue?: 'pierde_agua' | 'mantenimiento' | 'instalacion'; scenario?: 'maintenance' | 'installation';
  snapshot?: () => CustomerHomesSnapshot
} = {}) {
  const initialSnapshot = journeySnapshot()
  const snapshot = options.snapshot ?? (() => initialSnapshot)
  const issue = options.issue ?? 'pierde_agua'
  const scope = { scenario: options.scenario ?? (issue === 'instalacion' ? 'installation' : 'maintenance'),
    label: issue === 'pierde_agua' ? 'Mano de obra inicial para la falla informada' : 'Mano de obra inicial para el servicio informado', durationMinutes: 120,
    travelBufferMinutes: 30, initialLaborOnly: true as const, excludesUnpricedParts: true as const,
    allowsPredictedRepair: issue === 'pierde_agua', allowCustomerEquipmentDeclaration: false }
  const policy = { ...defaultQuotePolicy, approvedUntil: '2028-12-31', paymentCostRate: 0.06 }
  let payload: ReturnType<typeof previewPayloadSchema.parse> | null = null
  let committed: CustomerRequestResult | null = null
  let preparations = 0
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const service = createCustomerRequestService({
    now: () => journeyNow, mode: () => false, seller: async () => undefined,
    travel: async () => ({ source: 'google', origin: 'Base privada de fixture', destination: 'Visita 20', province: 'CABA',
      outboundKm: 3, returnKm: 4, outboundMinutes: 12, returnMinutes: 14, tolls: 0, tollsVerified: true, measuredAt: journeyNow.toISOString() }),
    write: async (name, args) => {
      calls.push({ name, args })
      if (name === 'read_customer_request_context') {
        const current = snapshot()
        const resolved = resolveRequestContext(current, journeyIds.equipment)
        if (resolved.kind !== 'located') throw new Error('Fixture inventory must exist before quote context is read')
        const { equipment, home, placement, floor, room, address } = resolved
        return { data: { context: { address, equipment: { id: equipment.id, version: equipment.version, nickname: equipment.nickname,
          capacity: equipment.capacity, technology: equipment.technology, declarationUsed: false }, home, floor, room, placement },
          policy: { id: journeyIds.policy, quotePolicyId: journeyIds.quotePolicy, approvedUntil: '2028-12-31T23:59:00Z', scope },
          quotePolicy: { id: journeyIds.quotePolicy, policy },
          candidates: [{ professionalId: journeyIds.professional, origin: 'Base privada de fixture', sellerAccountId: '1234' }], reason: null }, error: null }
      }
      if (name === 'persist_customer_request_preview') {
        payload = previewPayloadSchema.parse(args.p_payload)
        return { data: { status: 'ready', previewId: journeyIds.preview, quote: payload.quote, scope: scope.label, exclusions: payload.quote.exclusions, expiresAt: payload.expiresAt }, error: null }
      }
      if (name === 'read_customer_request_preview') return { data: { result: committed, payload, committed: Boolean(committed) }, error: null }
      if (name === 'prepare_customer_request' && payload) {
        preparations++
        committed = { status: 'ready', jobId: journeyIds.job, requestId: journeyIds.request, quoteId: journeyIds.quote,
          quote: payload.quote, scope: scope.label, exclusions: payload.quote.exclusions, expiresAt: payload.expiresAt }
        return { data: committed, error: null }
      }
      throw new Error(`Unexpected fixture RPC: ${name}`)
    }
  })
  return { service, calls, policy, get payload() { return payload }, get committed() { return committed }, get preparations() { return preparations } }
}
