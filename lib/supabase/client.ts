'use client'

import { createBrowserClient } from '@supabase/ssr'
import { assertPublicSupabaseEnv } from './env'

export function createClient() {
  const env = assertPublicSupabaseEnv()
  return createBrowserClient(env.url, env.anonKey)
}
