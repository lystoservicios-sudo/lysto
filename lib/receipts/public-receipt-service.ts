import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '@/lib/supabase/database.types'
import { enforceRateLimit, serverActionSubject } from '@/lib/security/rate-limit'

const tokenSchema = z.string().uuid()
export const publicReceiptSchema = z
  .object({
    service_name: z.string(),
    professional_name: z.string(),
    work_done: z.string(),
    final_state: z.string(),
    confirmation_status: z.enum(['pending_confirmation', 'confirmed', 'disputed']),
    warranty_until: z.string().nullable(),
    next_maintenance_date: z.string().nullable(),
    issued_at: z.string()
  })
  .strict()
export type PublicReceiptProjection = z.infer<typeof publicReceiptSchema>
export async function lookupPublicReceipt(
  rawToken: string,
  subject?: string
): Promise<PublicReceiptProjection | null> {
  const token = tokenSchema.safeParse(rawToken)
  if (!token.success) return null
  await enforceRateLimit('receipt', subject ?? (await serverActionSubject('public-receipt')))
  const url = z.string().url().parse(process.env.NEXT_PUBLIC_SUPABASE_URL),
    key = z.string().min(1).parse(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    }),
    result = await client.rpc('lookup_public_receipt', { p_token: token.data })
  if (result.error) throw new Error('receipt_unavailable')
  const row = Array.isArray(result.data) ? result.data[0] : null
  return row ? publicReceiptSchema.parse(row) : null
}
