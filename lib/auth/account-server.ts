import 'server-only'
import { headers } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAllowedAuthOrigin } from './account-lifecycle'

export type AccountClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

export async function assertAccountMutationOrigin() {
  const incoming = await headers()
  if (!isAllowedAuthOrigin(incoming.get('origin'), process.env.NEXT_PUBLIC_APP_URL)) throw new Error('Invalid account mutation origin')
}

export function accountFormText(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}

export async function bootstrapVerifiedCustomer(client: AccountClient, user: User): Promise<'ready' | 'incomplete'> {
  if (user.app_metadata.app_role !== 'customer') return 'ready'
  if (!user.email_confirmed_at) throw new Error('Email confirmation required')
  const { data, error } = await client.rpc('bootstrap_customer_account')
  if (error) throw new Error('Customer account could not be prepared')
  return data && typeof data === 'object' && !Array.isArray(data) && data.status === 'ready' ? 'ready' : 'incomplete'
}
