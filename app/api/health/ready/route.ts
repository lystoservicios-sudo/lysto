import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { parseServerEnv } from '@/lib/config/env'
import type { Database } from '@/lib/supabase/database.types'
import { runtimeSwitches } from '@/lib/release/runtime-switches'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const probeSchema = z.object({
  databaseTime: z.string(),
  outboxOldestPendingAt: z.string().nullable(),
  refundOldestPendingAt: z.string().nullable(),
  paymentReviewCount: z.number().int().nonnegative()
})

function ageSeconds(value: string | null) {
  return value ? Math.max(0, Math.round((Date.now() - Date.parse(value)) / 1000)) : null
}

export async function GET() {
  try {
    const env = parseServerEnv(process.env)
    const switches = runtimeSwitches(process.env)
    const client = createClient<Database>(env.public.supabaseUrl, env.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
    const operation = (
      client.rpc as unknown as (name: string) => Promise<{ data: unknown; error: unknown }>
    )('production_readiness_probe')
    const result = await Promise.race([
      operation,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('probe_timeout')), 3000))
    ])
    if (result.error) throw new Error('probe_failed')
    const probe = probeSchema.parse(result.data)
    return NextResponse.json(
      {
        status: 'ready',
        environment: switches.appEnv,
        acceptingNewRequests: switches.acceptNewRequests,
        allowingNewCheckouts: switches.allowNewCheckouts,
        queues: {
          outboxOldestPendingSeconds: ageSeconds(probe.outboxOldestPendingAt),
          refundOldestPendingSeconds: ageSeconds(probe.refundOldestPendingAt),
          paymentsInReview: probe.paymentReviewCount
        }
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      { status: 'not_ready' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
