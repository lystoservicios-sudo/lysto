import { cookies } from 'next/headers'
import { createServerClient, type SetAllCookies } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { assertPublicSupabaseEnv } from './env'
import type { Database } from './database.types'

const READONLY_COOKIE_ERROR_PREFIX = 'Cookies can only be modified in a Server Action or Route Handler.'
type CookieToSet = Parameters<SetAllCookies>[0][number]
type CookieSetter = (cookie: CookieToSet) => void

function isReadonlyCookieStoreError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith(READONLY_COOKIE_ERROR_PREFIX)
}

export function applySupabaseCookies(
  cookiesToSet: Parameters<SetAllCookies>[0],
  setCookie: CookieSetter
): void {
  try {
    cookiesToSet.forEach(setCookie)
  } catch (error) {
    if (!isReadonlyCookieStoreError(error)) throw error
  }
}

export async function createServerSupabaseClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()
  const env = assertPublicSupabaseEnv()
  return createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        applySupabaseCookies(cookiesToSet, ({ name, value, options }) => {
          cookieStore.set(name, value, options)
        })
      }
    }
  // The installed SSR adapter predates supabase-js's newer schema generics.
  // Expose the generated database contract at this single compatibility boundary.
  }) as unknown as SupabaseClient<Database>
}
