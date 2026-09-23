import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '@/lib/supabase/database.types'
import { assertPublicSupabaseEnv } from '@/lib/supabase/env'
import { authOrigin, type RegistrationPolicy } from './account-lifecycle'

const policySchema = z.object({
  terms_version: z.string().min(1), privacy_version: z.string().min(1),
  terms_url: z.string().url(), privacy_url: z.string().url(), test_only: z.boolean()
})

/** This service-role client reads only the public-facing legal policy. Never return the client or key. */
export async function getRegistrationPolicy(): Promise<RegistrationPolicy | null> {
  try {
    const origin = authOrigin(process.env.NEXT_PUBLIC_APP_URL)
    const env = assertPublicSupabaseEnv()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key) return null
    const client = createClient<Database>(env.url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    const { data, error } = await client.rpc('get_registration_policy')
    const parsed = policySchema.safeParse(data)
    if (error || !parsed.success) return null
    if (parsed.data.test_only && (process.env.APP_ENV !== 'test' || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname))) return null
    for (const [kind, value] of [
      ['terminos', parsed.data.terms_url],
      ['privacidad', parsed.data.privacy_url]
    ] as const) {
      const url = new URL(value)
      const canonicalStagingDocument =
        process.env.APP_ENV === 'staging' &&
        url.href === `https://lystohogar.com/${kind}`
      if ((!canonicalStagingDocument && url.origin !== origin) || url.username || url.password || url.hash) return null
    }
    return { termsVersion: parsed.data.terms_version, privacyVersion: parsed.data.privacy_version, termsUrl: parsed.data.terms_url, privacyUrl: parsed.data.privacy_url, testOnly: parsed.data.test_only }
  } catch { return null }
}
