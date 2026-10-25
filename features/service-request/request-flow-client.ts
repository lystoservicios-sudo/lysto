'use client'

import { z } from 'zod'
import type { CustomerRequestResult } from '@/lib/customer-requests/contracts'
import type { RequestDraft } from './request-draft'
import { earliestCustomerVisitDay } from '@/lib/scheduling/customer-booking-notice'
export { argentinaDay } from '@/lib/scheduling/customer-booking-notice'

export type RequestPreview = Omit<CustomerRequestResult, 'status'> & { status: 'ready' | 'needs_review' | 'unavailable' }
export type PreparedRequest = CustomerRequestResult
const uuid = z.string().uuid()
const paymentSchema = z.object({ previewId: uuid, commandId: uuid, jobId: uuid.nullable(), checkoutId: uuid.nullable() }).strict()
export type PendingRequestPayment = z.infer<typeof paymentSchema>
const photosSchema = z.record(z.string(), z.array(z.object({ intentId: uuid, name: z.string().min(1).max(255), bytes: z.number().int().positive().max(10 * 1024 * 1024) }).strict()).max(5))
export type RetainedRequestPhoto = z.infer<typeof photosSchema>[string][number]
export function readRequestPhotos(actor: string): Record<string, RetainedRequestPhoto[]> {
  try { const raw = window.sessionStorage.getItem(key(actor, 'photos')); return raw ? photosSchema.parse(JSON.parse(raw)) : {} }
  catch { return {} }
}
export function storeRequestPhotos(actor: string, photos: Record<string, RetainedRequestPhoto[]>) {
  try { window.sessionStorage.setItem(key(actor, 'photos'), JSON.stringify(photosSchema.parse(photos))) }
  catch { throw new Error('No pudimos conservar las fotos en el borrador de esta pestaña. No recargues la página hasta terminar el pedido.') }
}
export function clearRequestPhotos(actor: string) { try { window.sessionStorage.removeItem(key(actor, 'photos')) } catch { /* Server ownership and consumed intents still prevent cross-request reuse. */ } }
const location = z.object({ homeId: uuid, addressId: uuid, floorId: uuid, roomId: uuid, homeVersion: z.number().int().positive() }).strict().nullable()
const common = { location, characteristics: z.object({ capacity: z.number().int().min(1000).max(30000).nullable(), technology: z.enum(['conventional', 'inverter', 'unknown']) }).strict().nullable(), schedule: z.object({ preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), preferredTimeWindow: z.string(), urgency: z.enum(['flexible', 'priority']) }).strict().nullable(), orientationAccepted: z.boolean() }
const answers = z.discriminatedUnion('purpose', [
  z.object({ ...common, purpose: z.literal('repair'), issue: z.enum(['no_enfria', 'pierde_agua', 'hace_ruido', 'no_enciende', 'no_funciona_calor', 'unknown']).nullable(), details: z.object({ kind: z.literal('repair'), description: z.string().max(500), timeSince: z.enum(['today', 'days', 'weeks', 'months']).optional(), frequency: z.enum(['constant', 'intermittent', 'unknown']).optional(), symptomContext: z.string().max(80).optional() }).strict() }).strict(),
  z.object({ ...common, purpose: z.literal('maintenance'), issue: z.null(), details: z.object({ kind: z.literal('maintenance'), description: z.string().max(500), lastMaintenance: z.enum(['never', 'under_6_months', '6_to_12_months', 'over_1_year', 'unknown']).optional() }).strict() }).strict(),
  z.object({ ...common, purpose: z.literal('installation'), issue: z.null(), details: z.object({ kind: z.literal('installation'), description: z.string().max(500), installationType: z.enum(['new', 'relocation', 'unknown']).optional() }).strict() }).strict()
])
const draftSchema = z.object({ actorId: uuid, selectedEquipmentId: uuid.nullable(), step: z.enum(['issue', 'location', 'details', 'orientation', 'schedule', 'review', 'payment']), answersByEquipment: z.record(z.string(), answers), inputRevision: z.number().int().nonnegative(), quote: z.object({ id: uuid, actorId: uuid, inputRevision: z.number().int().nonnegative() }).strict().nullable() }).strict()
const key = (actor: string, scope: string) => `lysto:pedir:${scope}:${actor}`
export function readRequestDraft(actorId: string): RequestDraft | null {
  try {
    const raw = window.sessionStorage.getItem(key(actorId, 'draft'))
    const parsed = raw ? draftSchema.safeParse(JSON.parse(raw)) : null
    if (!parsed?.success || parsed.data.actorId !== actorId || !parsed.data.answersByEquipment[parsed.data.selectedEquipmentId ?? '$new']) return null
    return { ...parsed.data, quote: null }
  } catch { return null }
}
export function storeRequestDraft(draft: RequestDraft) {
  try { window.sessionStorage.setItem(key(draft.actorId, 'draft'), JSON.stringify(draftSchema.parse({ ...draft, quote: null }))) }
  catch { /* Losing a local draft must never authorize a write; pending commands use strict persistence below. */ }
}
export function clearRequestDraft(actor: string) { try { window.sessionStorage.removeItem(key(actor, 'draft')) } catch { /* A restored draft never authorizes payment. */ } }
export function readPendingPayment(actor: string): { payment: PendingRequestPayment | null; error: string } {
  try {
    const raw = window.sessionStorage.getItem(key(actor, 'payment'))
    return { payment: raw ? paymentSchema.parse(JSON.parse(raw)) : null, error: '' }
  } catch { return { payment: null, error: 'No pudimos recuperar el pago pendiente. Revisá Servicios antes de iniciar otro pedido.' } }
}
export function storePendingPayment(actor: string, payment: PendingRequestPayment) {
  uuid.parse(actor)
  const serialized = JSON.stringify(paymentSchema.parse(payment))
  try {
    window.sessionStorage.setItem(key(actor, 'payment'), serialized)
    if (window.sessionStorage.getItem(key(actor, 'payment')) !== serialized) throw new Error('storage')
  } catch { throw new Error('Habilitá el almacenamiento de esta pestaña antes de continuar. Todavía no iniciamos el pago.') }
}
export function clearPendingPayment(actor: string) {
  try { window.sessionStorage.removeItem(key(actor, 'payment')) } catch { /* Exact replay remains safe. */ }
}
export function futureVisitDays(now = new Date(), count = 4) {
  const firstDay = new Date(`${earliestCustomerVisitDay(now)}T12:00:00Z`)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(firstDay.getTime() + index * 86400000)
    return { value: date.toISOString().slice(0, 10), label: new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'short', day: 'numeric', month: 'short' }).format(date) }
  })
}
export function safeCheckoutUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return url.protocol === 'https:' && !url.username && !url.password && (host === 'mercadopago.com.ar' || host.endsWith('.mercadopago.com.ar')) ? url.href : null
  } catch { return null }
}
export function paymentPresentation(status: string | null) {
  if (status === 'approved') return { title: 'Pago confirmado', message: 'Tu pago fue verificado. Podés seguir los próximos pasos desde Servicios.', tone: 'success' }
  if (status === 'rejected' || status === 'cancelled') return { title: 'El pago no se completó', message: 'Podés revisar el estado y volver a intentar desde el detalle del servicio.', tone: 'neutral' }
  if (status === 'review' || status === 'refunded' || status === 'charged_back') return { title: 'Estamos revisando el estado del pago', message: 'Consultá el detalle del servicio antes de iniciar otro pago.', tone: 'neutral' }
  if (status === 'expired') return { title: 'El enlace de pago venció', message: 'Revisá el detalle del servicio para continuar. No inicies otro pedido para el mismo equipo.', tone: 'neutral' }
  return { title: 'Estamos comprobando tu pago', message: 'Volver de Mercado Pago no confirma el pago. Te mostramos el estado cuando el sistema lo verifica.', tone: 'neutral' }
}
