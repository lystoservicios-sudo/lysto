export function getPublicSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  }
}

export function assertPublicSupabaseEnv() {
  const env = getPublicSupabaseEnv()
  if (!env.url || !env.anonKey) throw new Error('Missing public Supabase environment variables')
  return env as { url: string; anonKey: string }
}
