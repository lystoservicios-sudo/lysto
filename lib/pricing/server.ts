import { createClient } from '@supabase/supabase-js'
import { z, ZodError } from 'zod'
import {
  requireSession,
  requireAdminPermission,
  type AdminPermission,
  type Session
} from '../auth/session'
import { ApiError, apiErrorResponse, privateJson } from '../http/api-error'
import type { Database } from '../supabase/database.types'
import { defaultQuotePolicy, quotePolicySchema } from './service-quote'

export async function getPricingSession() {
  return requireSession()
}
export type PricingSession = Session
export async function requirePricingPermission(
  session: PricingSession,
  permission: AdminPermission
) {
  return requireAdminPermission(permission, session)
}
export async function getQuotePolicy(client: PricingSession['client']) {
  const { data, error } = await client.rpc('get_quote_policy')
  if (error) throw new Error('pricing_database_not_ready')
  return data ? quotePolicySchema.parse(data) : defaultQuotePolicy
}
export function quoteWriter() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('quote_storage_not_configured')
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}
export function pricingError(error: unknown) {
  if (error instanceof ApiError || error instanceof SyntaxError) return apiErrorResponse(error)
  const code = error instanceof Error ? error.message : 'pricing_unavailable'
  if (error instanceof ZodError)
    return privateJson(
      { error: 'Revisá los datos del presupuesto.', code: 'invalid_input' },
      { status: 400 }
    )
  if (code === 'unauthorized' || code === 'forbidden') return apiErrorResponse(new ApiError(code))
  const messages: Record<string, string> = {
    routing_not_configured: 'El cálculo de traslado todavía no está configurado.',
    quote_storage_not_configured: 'El guardado de presupuestos todavía no está configurado.',
    pricing_database_not_ready:
      'Es necesario actualizar la base de datos para usar los presupuestos.',
    outside_coverage: 'El domicilio está fuera de la cobertura de Lysto.',
    address_ambiguous:
      'No pudimos identificar una dirección exacta. Revisá calle, altura y localidad.',
    invalid_departure_time: 'Elegí una fecha y hora futuras.',
    quote_requires_review: 'El presupuesto necesita revisión antes de ofrecerse.',
    quote_expired: 'El presupuesto venció. Volvé a calcularlo.',
    quote_policy_changed:
      'La tarifa no está aprobada, cambió o venció. Operaciones debe recalcular el presupuesto antes de ofrecerlo.',
    manual_quote_required: 'Este trabajo necesita una cotización técnica específica.',
    offer_unavailable:
      'La propuesta cambió o no está disponible para ese profesional. Actualizá la lista.',
    job_transition_unavailable:
      'El estado del trabajo cambió o falta resolver un adicional. Actualizá la página antes de continuar.',
    initial_payment_required:
      'El cliente debe completar el pago inicial y Mercado Pago debe aprobarlo antes de iniciar la visita.'
  }
  const known = code.split(':')[0]
  return privateJson(
    {
      error:
        messages[known] ??
        'No se pudo completar la operación. Revisá los datos o contactá a operaciones.',
      code: known in messages ? known : 'pricing_unavailable'
    },
    { status: known.includes('configured') || known === 'pricing_database_not_ready' ? 503 : 400 }
  )
}
export async function getQuotePolicyRecord(client: PricingSession['client']) {
  const { data, error } = await client.rpc('get_quote_policy_record')
  if (error) throwPricingDatabaseError(error)
  const record = z
    .object({
      id: z.string().uuid().nullable(),
      revision: z.number().int().nonnegative(),
      policy: quotePolicySchema.nullable()
    })
    .parse(data)
  return { ...record, policy: record.policy ?? defaultQuotePolicy }
}
export function throwPricingDatabaseError(error: { code?: string; message?: string }): never {
  if (error.code === '42501') throw new ApiError('forbidden')
  if (error.code === '40001' || error.code === '23505') throw new ApiError('conflict')
  if (error.code === 'P0002') throw new ApiError('not_found')
  if (error.message?.includes('expired')) throw new Error('quote_expired')
  if (error.message?.includes('Current approved tariff required'))
    throw new Error('quote_policy_changed')
  if (error.message?.includes('Verified complete quote inputs required'))
    throw new Error('quote_requires_review')
  if (error.message?.includes('Quote requires review')) throw new Error('quote_requires_review')
  if (error.code?.startsWith('22') || error.code === '23514') throw new ApiError('invalid_input')
  throw new ApiError('service_unavailable')
}
