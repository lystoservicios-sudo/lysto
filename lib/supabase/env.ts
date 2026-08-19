import { parsePublicEnv, type EnvSource } from '../config/env'

function getNextPublicEnv(): EnvSource {
  return {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  }
}

export function getPublicSupabaseEnv(env: EnvSource = getNextPublicEnv()) {
  const parsed = parsePublicEnv(env)

  return {
    url: parsed.supabaseUrl,
    anonKey: parsed.supabasePublishableKey
  }
}

export function assertPublicSupabaseEnv(env: EnvSource = getNextPublicEnv()) {
  return getPublicSupabaseEnv(env)
}
