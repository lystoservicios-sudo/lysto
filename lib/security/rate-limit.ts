import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '@/lib/supabase/database.types'
import { ApiError } from '@/lib/http/api-error'

export type RateLimitCategory =
  | 'auth'
  | 'registration'
  | 'recovery'
  | 'quote'
  | 'receipt'
  | 'private_mutation'
  | 'webhook'
const policies: Record<RateLimitCategory, { limit: number; windowSeconds: number }> = {
  auth: { limit: 10, windowSeconds: 300 },
  registration: { limit: 5, windowSeconds: 3600 },
  recovery: { limit: 5, windowSeconds: 3600 },
  quote: { limit: 20, windowSeconds: 300 },
  receipt: { limit: 30, windowSeconds: 300 },
  private_mutation: { limit: 60, windowSeconds: 60 },
  webhook: { limit: 300, windowSeconds: 60 }
}
export function rateLimitKey(category: RateLimitCategory, subject: string, secret: string) {
  if (secret.length < 32) throw new Error('rate_limit_secret_required')
  return `${category}:${createHmac('sha256', secret).update(subject).digest('hex')}`
}
export function requestSubject(request: Request, fallback = 'anonymous') {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip') || fallback
}
export async function serverActionSubject(identifier: string) {
  const { headers } = await import('next/headers')
  const values = await headers()
  return `${values.get('x-forwarded-for')?.split(',')[0]?.trim() ?? values.get('x-real-ip') ?? 'unknown'}:${identifier.trim().toLowerCase()}`
}
export async function enforceRateLimit(category: RateLimitCategory, subject: string) {
  if (process.env.NODE_ENV === 'test' && !process.env.RATE_LIMIT_HASH_KEY)
    return { allowed: true, retryAfter: 0, remaining: Number.MAX_SAFE_INTEGER }
  const secret = z.string().min(32).parse(process.env.RATE_LIMIT_HASH_KEY),
    url = z.string().url().parse(process.env.NEXT_PUBLIC_SUPABASE_URL),
    key = z.string().min(1).parse(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const policy = policies[category]
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  const result = await (
    client.rpc as unknown as (
      n: string,
      a: Record<string, unknown>
    ) => Promise<{ data: unknown; error: unknown }>
  )('consume_rate_limit', {
    p_key: rateLimitKey(category, subject, secret),
    p_limit: policy.limit,
    p_window_seconds: policy.windowSeconds
  })
  if (result.error) throw new ApiError('service_unavailable')
  const parsed = z
    .object({
      allowed: z.boolean(),
      retryAfter: z.number().int().nonnegative(),
      remaining: z.number().int().nonnegative()
    })
    .parse(result.data)
  if (!parsed.allowed) throw new RateLimitExceeded(parsed.retryAfter)
  return parsed
}
export class RateLimitExceeded extends Error {
  constructor(readonly retryAfter: number) {
    super('rate_limited')
  }
}
export function rateLimitResponse(error: RateLimitExceeded) {
  return new Response(
    JSON.stringify({
      error: 'Demasiados intentos. Esperá antes de volver a probar.',
      code: 'rate_limited'
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store',
        'Retry-After': String(Math.max(1, error.retryAfter))
      }
    }
  )
}
