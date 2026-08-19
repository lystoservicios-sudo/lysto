import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { assertPublicSupabaseEnv } from './env'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  const env = assertPublicSupabaseEnv()
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
      }
    }
  })
}
