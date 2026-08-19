'use client'

import { createBrowserClient } from '@supabase/ssr'
import { assertPublicSupabaseEnv } from './env'
import type { Database } from './database.types'

export function createClient() {
  const env = assertPublicSupabaseEnv()
  return createBrowserClient<Database>(env.url, env.anonKey)
}
