import 'server-only'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
import type { Json } from '@/lib/supabase/database.types'
import { quoteInputSchema, type TravelEstimate } from '@/lib/pricing/service-quote'
import { estimateTravel } from '@/lib/pricing/google-routes'
import { quoteWriter } from '@/lib/pricing/server'
import { marketplaceConfig } from '@/lib/payments/marketplace-config'
import { calculateInitialLaborQuote } from './quote'
import { requestContextSchema, requestPreviewInputSchema, requestPrepareInputSchema, requestResultSchema,
  previewPayloadSchema, type CustomerRequestResult } from './contracts'

type RequestRpc = 'read_customer_request_context' | 'persist_customer_request_preview' | 'read_customer_request_preview' | 'prepare_customer_request'
type DatabaseResult = { data: unknown; error: { code?: string; message?: string } | null }
export type CustomerRequestDependencies = {
  write: (name: RequestRpc, args: Record<string, Json>) => Promise<DatabaseResult>
  travel: (input: { origin: string; address: string; departureTime: string; visitDurationMinutes: number; now: Date }) => Promise<TravelEstimate>
  seller: (professionalId: string, sellerAccountId: string, liveMode: boolean) => Promise<void>
  mode: () => boolean
  now: () => Date
}
const reasons: Record<string, string> = {
  tariffs_unapproved: 'El precio de este servicio necesita una verificación. Todavía no tenés que pagar.',
  initial_scope_unavailable: 'Este servicio necesita una revisión del alcance antes del pago.',
  diagnosis_required: 'Necesitamos revisar la falla para confirmar el alcance del servicio.',
  equipment_unknown: 'Falta confirmar la capacidad o tecnología del aire antes de calcular un precio final.',
  equipment_declaration_requires_review: 'Los datos que indicás del aire necesitan una revisión antes de confirmar el precio.',
  capacity_outside_catalog: 'Por la capacidad de este aire, el servicio requiere un presupuesto específico.',
  equipment_category_unavailable: 'Necesitamos verificar los datos de este equipo.',
  no_available_professional: 'No encontramos disponibilidad para ese horario. Podés elegir otra fecha.',
  professional_unavailable: 'Ese horario ya no está disponible. Elegí otro o actualizá la solicitud.',
  travel_unverified: 'Falta verificar el traslado para completar el precio. Todavía no tenés que pagar.',
  outside_coverage: 'Este domicilio requiere una verificación de cobertura.',
  specialist_access: 'El acceso requiere recursos especiales. Revisaremos el alcance antes del pago.',
  professional_cost_floor: 'Necesitamos revisar este presupuesto antes de confirmar el precio.',
  tariffs_changed: 'El precio necesita actualizarse antes de pagar.',
  payment_mode_mismatch: 'El pago no está disponible en este ambiente. No se inició ningún cobro.',
  seller_not_linked: 'No pudimos preparar el pago para ese horario. Podés actualizar la solicitud.',
  payments_not_configured: 'El pago todavía no está disponible. No se inició ningún cobro.',
  payment_unavailable: 'No pudimos verificar el pago para ese horario. Actualizá la solicitud antes de continuar.'
}
function failure(reason: string, status: 'needs_review' | 'unavailable' = 'needs_review'): CustomerRequestResult {
  return { status, reason, message: reasons[reason] ?? 'Necesitamos revisar este servicio antes de habilitar el pago.' }
}
function assertActor(session: Session) {
  if (session.role !== 'customer' || !session.customerId || !session.userId || !session.sessionId) throw new ApiError('forbidden')
  return { p_actor_user_id: session.userId, p_actor_session_id: session.sessionId, p_customer_id: session.customerId }
}
function readResult(result: DatabaseResult) {
  if (result.error) {
    const code = result.error.code
    if (code === '42501') throw new ApiError('forbidden')
    if (code === 'P0002') throw new ApiError('not_found')
    if (code === 'PT409' || code === '40001' || code === '23505' || code === '23P01') throw new ApiError('conflict')
    if (code?.startsWith('22') || code === '23514') throw new ApiError('invalid_input')
    throw new ApiError('service_unavailable')
  }
  return result.data
}
function parseResult(raw: unknown): CustomerRequestResult {
  const result = requestResultSchema.safeParse(raw)
  if (!result.success) throw new ApiError('service_unavailable')
  if (result.data.status === 'ready' && (!result.data.quote || (!result.data.previewId && (!result.data.jobId || !result.data.requestId || !result.data.quoteId))))
    throw new ApiError('service_unavailable')
  return result.data.message || !result.data.reason ? result.data : { ...result.data, message: reasons[result.data.reason] ?? failure(result.data.reason).message }
}
async function validateSeller(professionalId: string, sellerAccountId: string, liveMode: boolean) {
  const { marketplaceOAuth, marketplaceStorage, providerJson } = await import('@/lib/payments/marketplace')
  const account = await marketplaceStorage().getConnectedAccount(professionalId)
  if (!account?.enabled || account.mercadoPagoUserId !== sellerAccountId) throw new Error('seller_not_linked')
  const token = await marketplaceOAuth().getValidAccessToken(professionalId)
  // Reuse the existing gateway mode boundary; no token enters HTTP or logs.
  if (token.startsWith('TEST-') === liveMode) throw new Error('payment_mode_mismatch')
  const accountIdentity = await providerJson('/users/me', token)
  if (String(accountIdentity.id) !== sellerAccountId) throw new Error('seller_not_linked')
}
function sellerFailure(error: unknown) {
  const code = error instanceof Error ? error.message : ''
  return failure(['payment_mode_mismatch', 'seller_not_linked', 'payments_not_configured'].includes(code) ? code : 'payment_unavailable', 'unavailable')
}

/** The calculator and external reads run outside SQL transactions/locks. */
export function createCustomerRequestService(deps: CustomerRequestDependencies) {
  async function preview(session: Session, rawInput: unknown): Promise<CustomerRequestResult> {
    const actor = assertActor(session)
    const input = requestPreviewInputSchema.parse(rawInput)
    const currentRaw = readResult(await deps.write('read_customer_request_context', { ...actor, p_input: input as Json }))
    const parsed = requestContextSchema.safeParse(currentRaw)
    if (!parsed.success) throw new ApiError('service_unavailable')
    const current = parsed.data
    if (current.reason) return failure(current.reason, current.reason === 'no_available_professional' ? 'unavailable' : 'needs_review')
    const now = deps.now(), { equipment, address } = current.context
    if (input.issue === 'unknown') return failure('diagnosis_required')
    if (equipment.capacity === null || equipment.technology === 'unknown') return failure('equipment_unknown')
    if (equipment.capacity > 18000) return failure('capacity_outside_catalog')
    if (!current.policy || !current.quotePolicy.id || !current.quotePolicy.policy || current.policy.quotePolicyId !== current.quotePolicy.id ||
      Date.parse(current.policy.approvedUntil) <= now.getTime()) return failure('initial_scope_unavailable')
    if (equipment.declarationUsed && !current.policy.scope.allowCustomerEquipmentDeclaration) return failure('equipment_declaration_requires_review')
    if (!current.candidates.length) return failure('no_available_professional', 'unavailable')
    let liveMode: boolean
    try { liveMode = deps.mode() } catch (error) { return sellerFailure(error) }
    const departureTime = `${input.preferredDate}T${input.timeWindow.slice(0, 5)}:00-03:00`
    if (Date.parse(departureTime) <= now.getTime()) throw new ApiError('invalid_input')
    const access = Object.fromEntries(Object.entries(address.access).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'))
    let lastFailure = failure('no_available_professional', 'unavailable')
    // Keep the server's deterministic eligibility order. A candidate whose
    // seller/origin is unsupported cannot prevent a later eligible one from
    // receiving a quote; never swap the chosen candidate after client consent.
    for (const candidate of current.candidates.slice(0, 5)) {
      try { await deps.seller(candidate.professionalId, candidate.sellerAccountId, liveMode) }
      catch (error) {
        lastFailure = sellerFailure(error)
        if (error instanceof Error && ['seller_not_linked', 'payment_mode_mismatch'].includes(error.message)) continue
        return lastFailure
      }
      let route: TravelEstimate
      try {
        route = await deps.travel({ address: `${address.street} ${address.number}, ${address.city}, ${address.province}, Argentina`,
          origin: candidate.origin, departureTime, visitDurationMinutes: current.policy.scope.durationMinutes, now })
      } catch (error) {
        lastFailure = failure(error instanceof Error && error.message === 'outside_coverage' ? 'outside_coverage' : 'travel_unverified')
        if (error instanceof Error && error.message === 'origin_must_be_caba') continue
        return lastFailure
      }
      const publicRoute = { ...route, origin: 'Origen del profesional', destination: 'Dirección de visita' }
      const calculatedInput = quoteInputSchema.parse({ issue: input.issue, timeSince: input.timeSince, urgency: input.urgency,
        propertyType: address.propertyType, access, equipment: { capacity: equipment.capacity, technology: equipment.technology },
        route: publicRoute, scenario: current.policy.scope.scenario, materials: [], materialsConfirmed: false })
      let quote: ReturnType<typeof calculateInitialLaborQuote>
      try { quote = calculateInitialLaborQuote(calculatedInput, current.quotePolicy.policy, current.policy.scope, now) }
      catch (error) {
        return failure(error instanceof Error && error.message === 'professional_cost_floor' ? 'professional_cost_floor' : 'initial_scope_unavailable')
      }
      if (!quote.readyToOffer) return { ...failure(quote.reviewReasons[0]), quote, scope: quote.scope, exclusions: quote.exclusions }
      const expiresAt = new Date(Math.min(Date.parse(quote.expiresAt), now.getTime() + 30 * 60000, Date.parse(current.policy.approvedUntil))).toISOString()
      const payload = { input, context: current.context, policyId: current.policy.id, quotePolicyId: current.quotePolicy.id,
        quotePolicySnapshot: current.quotePolicy.policy, scope: current.policy.scope, professionalId: candidate.professionalId,
        sellerAccountId: candidate.sellerAccountId, origin: candidate.origin, route, calculatedInput, quote, liveMode, expiresAt }
      return parseResult(readResult(await deps.write('persist_customer_request_preview', { ...actor, p_payload: payload as unknown as Json })))
    }
    return lastFailure
  }
  async function prepare(session: Session, rawInput: unknown): Promise<CustomerRequestResult> {
    const actor = assertActor(session), input = requestPrepareInputSchema.parse(rawInput)
    const read = readResult(await deps.write('read_customer_request_preview', { ...actor, p_preview_id: input.previewId, p_command_id: input.commandId }))
    const snapshot = z.object({ result: z.unknown().nullable(), payload: z.unknown(), committed: z.boolean().default(false) }).strict().safeParse(read)
    if (!snapshot.success) throw new ApiError('service_unavailable')
    // Recover a committed command even after policy/connection/quote expiry.
    if (snapshot.data.result) return parseResult(snapshot.data.result)
    if (snapshot.data.committed)
      return parseResult(readResult(await deps.write('prepare_customer_request', { ...actor, p_preview_id: input.previewId, p_command_id: input.commandId })))
    const checked = previewPayloadSchema.safeParse(snapshot.data.payload)
    if (!checked.success) throw new ApiError('service_unavailable')
    const payload = checked.data
    if (Date.parse(payload.expiresAt) <= deps.now().getTime()) return { status: 'price_changed', reason: 'quote_expired', message: 'El cálculo venció. Actualizalo antes de pagar.' }
    try {
      if (deps.mode() !== payload.liveMode) throw new Error('payment_mode_mismatch')
      await deps.seller(payload.professionalId, payload.sellerAccountId, payload.liveMode)
    } catch (error) { return sellerFailure(error) }
    return parseResult(readResult(await deps.write('prepare_customer_request', { ...actor, p_preview_id: input.previewId, p_command_id: input.commandId })))
  }
  return { preview, prepare }
}

export const customerRequestService = createCustomerRequestService({
  write: async (name, args) => quoteWriter().rpc(name, args as never),
  travel: input => estimateTravel({ ...input, apiKey: process.env.GOOGLE_MAPS_SERVER_API_KEY ?? '' }),
  seller: validateSeller, mode: () => marketplaceConfig().liveMode, now: () => new Date()
})
