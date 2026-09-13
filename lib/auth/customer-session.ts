import 'server-only'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { bootstrapVerifiedCustomer } from './account-server'
import { customerDestination, missingCustomerFields, safeCustomerNext } from './customer-access'

const activeCustomer = z.object({ role: z.literal('customer'), profile_id: z.string().uuid(), customer_id: z.string().uuid(), session_active: z.literal(true), session_id: z.string().uuid() })

export async function readCustomerSession(client?: SupabaseClient<Database> | Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const supabase = (client ?? await createServerSupabaseClient()) as unknown as SupabaseClient<Database>
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { kind: 'anonymous' as const }
  if (user.app_metadata.app_role !== 'customer') return { kind: 'unavailable' as const }
  if (!user.email_confirmed_at) return { kind: 'unverified' as const }
  // OAuth identities receive domain profiles only after explicit legal acceptance.
  if (await bootstrapVerifiedCustomer(supabase, user) === 'incomplete') return { kind: 'incomplete' as const, user }
  const context = await supabase.rpc('get_session_context')
  const current = activeCustomer.safeParse(context.data)
  if (context.error) throw new Error('customer_session_unavailable')
  if (!current.success) return { kind: 'unavailable' as const }
  const { data: profile, error: profileError } = await supabase.from('profiles').select('id,role,first_name,last_name,phone,version,notification_preference').eq('id', current.data.profile_id).eq('auth_user_id', user.id).maybeSingle()
  if (profileError) throw new Error('customer_profile_unavailable')
  if (!profile || profile.role !== 'customer') return { kind: 'unavailable' as const }
  const { data: addresses, error: addressError } = await supabase.from('customer_addresses').select('id,label,street,number,floor,apartment,city,province,property_type,reference,postal_code,has_elevator,has_parking,stairs_required,outdoor_unit_at_height,outdoor_unit_on_balcony,difficult_access,version,is_default').eq('customer_id', current.data.customer_id).is('archived_at', null).order('is_default', { ascending: false }).order('created_at', { ascending: true })
  if (addressError) throw new Error('customer_address_unavailable')
  const address = addresses?.find((item) => missingCustomerFields(profile, item).every((key) => ['first_name', 'last_name', 'phone'].includes(key))) ?? addresses?.[0] ?? null
  return { kind: 'customer' as const, user, profile, customer: { id: current.data.customer_id }, address, verified: true }
}

export async function resolvedCustomerDestination(next?: string, client?: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const destination = safeCustomerNext(next)
  const session = await readCustomerSession(client)
  if (session.kind === 'anonymous') return `/login?next=${encodeURIComponent(destination)}`
  if (session.kind === 'unverified') return '/login?notice=confirm-email'
  if (session.kind === 'incomplete') return `/completar-cuenta?next=${encodeURIComponent(destination)}`
  if (session.kind === 'unavailable') {
    await (client ?? await createServerSupabaseClient()).auth.signOut({ scope: 'local' })
    return '/login?notice=account-unavailable'
  }
  return customerDestination(session, destination)
}
