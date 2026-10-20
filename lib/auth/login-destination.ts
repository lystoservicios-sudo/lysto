import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { readTrustedRole, safeLocalRedirectPath } from './session-routing'

/** Navigation only: the destination still applies its own profile and MFA checks. */
export async function existingLoginDestination(next?: string): Promise<string | null> {
  try {
    const client = await createServerSupabaseClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user?.email_confirmed_at) return null
    const role = readTrustedRole(user.app_metadata)
    if (!role) return null
    const context = await client.rpc('get_session_context')
    if (context.error || !context.data || typeof context.data !== 'object' ||
        Array.isArray(context.data) || context.data.role !== role ||
        context.data.session_active !== true) return null
    return safeLocalRedirectPath(next, role)
  } catch {
    // A transient Auth outage must not turn the public login page into an error.
    return null
  }
}
