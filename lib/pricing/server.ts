import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ZodError } from 'zod'
import { createServerSupabaseClient } from '../supabase/server'
import type { Database } from '../supabase/database.types'
import { defaultQuotePolicy, quotePolicySchema } from './service-quote'

export async function getPricingSession() {
  // SSR 0.5 declares the old supabase-js generic order. The runtime client is
  // identical; bind its current public-schema type explicitly at this boundary.
  const client = await createServerSupabaseClient() as unknown as SupabaseClient<Database>
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) throw new Error('unauthorized')
  const { data: profile, error: profileError } = await client.from('profiles').select('id,role').eq('auth_user_id', user.id).single()
  if (profileError || !profile || user.app_metadata.app_role !== profile.role) throw new Error('forbidden')
  const { data: customer } = profile.role === 'customer' ? await client.from('customer_profiles').select('id').eq('profile_id', profile.id).single() : { data: null }
  return { client, userId: user.id, profileId: profile.id, role: profile.role, customerId: customer?.id }
}
export type PricingSession = Awaited<ReturnType<typeof getPricingSession>>
export async function getQuotePolicy(client: PricingSession['client']) {
  const { data, error } = await client.rpc('get_quote_policy')
  if (error) throw new Error('pricing_database_not_ready')
  return data ? quotePolicySchema.parse(data) : defaultQuotePolicy
}
export function quoteWriter() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('quote_storage_not_configured')
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
export function pricingError(error: unknown) {
  const code = error instanceof Error ? error.message : 'pricing_unavailable'
  if (error instanceof ZodError) return NextResponse.json({ error: 'Revisá los datos del presupuesto.', code: 'invalid_input' }, { status: 400 })
  if (code === 'unauthorized' || code === 'forbidden') return NextResponse.json({ error: 'Iniciá sesión con una cuenta autorizada.', code }, { status: code === 'unauthorized' ? 401 : 403 })
  const messages: Record<string, string> = {
    routing_not_configured: 'El cálculo de traslado todavía no está configurado.', quote_storage_not_configured: 'El guardado de presupuestos todavía no está configurado.',
    pricing_database_not_ready: 'Es necesario actualizar la base de datos para usar los presupuestos.', outside_coverage: 'El domicilio está fuera de la cobertura de Lysto.',
    address_ambiguous: 'No pudimos identificar una dirección exacta. Revisá calle, altura y localidad.', invalid_departure_time: 'Elegí una fecha y hora futuras.',
    quote_requires_review: 'El presupuesto necesita revisión antes de ofrecerse.', quote_expired: 'El presupuesto venció. Volvé a calcularlo.',
    manual_quote_required: 'Este trabajo necesita una cotización técnica específica.',
    offer_unavailable: 'La propuesta cambió o no está disponible para ese profesional. Actualizá la lista.',
    job_transition_unavailable: 'El estado del trabajo cambió o falta resolver un adicional. Actualizá la página antes de continuar.'
    ,initial_payment_required: 'El cliente debe completar el pago inicial y Mercado Pago debe aprobarlo antes de iniciar la visita.'
  }
  const known = code.split(':')[0]
  return NextResponse.json({ error: messages[known] ?? 'No se pudo completar la operación. Revisá los datos o contactá a operaciones.', code: known in messages ? known : 'pricing_unavailable' }, { status: known.includes('configured') || known === 'pricing_database_not_ready' ? 503 : 400 })
}
