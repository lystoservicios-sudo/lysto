import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { customerDestination, missingCustomerFields } from './customer-access'

export async function readCustomerSession(client?: SupabaseClient<Database> | Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  // SSR 0.5 uses an older supabase-js generic order; preserve the current schema type.
  const supabase = (client ?? await createServerSupabaseClient()) as unknown as SupabaseClient<Database>
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { kind: 'anonymous' as const }
  if (user.app_metadata.app_role !== 'customer') return { kind: 'unavailable' as const }
  const { data: profile, error: profileError } = await supabase.from('profiles').select('id,role,first_name,last_name,phone').eq('auth_user_id', user.id).maybeSingle()
  if (profileError || !profile || profile.role !== 'customer') return { kind: 'unavailable' as const }
  const { data: customer, error: customerError } = await supabase.from('customer_profiles').select('id').eq('profile_id', profile.id).maybeSingle()
  if (customerError || !customer) return { kind: 'unavailable' as const }
  const { data: addresses, error: addressError } = await supabase.from('customer_addresses').select('id,street,number,floor,apartment,city,province,property_type,reference,postal_code,has_elevator,has_parking,stairs_required,outdoor_unit_at_height,outdoor_unit_on_balcony,difficult_access').eq('customer_id', customer.id).order('is_default', { ascending: false }).order('created_at', { ascending: true })
  if (addressError) throw new Error('customer_address_unavailable')
  const address = addresses?.length
    ? addresses.find((item) => missingCustomerFields(profile, item).every((key) => ['first_name', 'last_name', 'phone'].includes(key))) ?? addresses[0]
    : null
  return { kind: 'customer' as const, user, profile, customer, address, verified: Boolean(user.email_confirmed_at) }
}

export async function resolvedCustomerDestination(next?: string, client?: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const session = await readCustomerSession(client)
  if (session.kind === 'anonymous') return '/login'
  if (session.kind === 'unavailable') {
    const supabase = client ?? await createServerSupabaseClient()
    await supabase.auth.signOut()
    return '/login?notice=account-unavailable'
  }
  return customerDestination(session, next)
}
