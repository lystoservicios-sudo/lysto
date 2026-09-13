import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { z } from 'zod'
import type { Json } from '@/lib/supabase/database.types'
import { quotePolicySchema } from '@/lib/pricing/service-quote'
import {
  getPricingSession,
  getQuotePolicyRecord,
  pricingError,
  requirePricingPermission,
  throwPricingDatabaseError
} from '@/lib/pricing/server'
export async function GET() {
  try {
    const s = await getPricingSession()
    return privateJson(await getQuotePolicyRecord(s.client))
  } catch (error) {
    return pricingError(error)
  }
}
export async function PUT(request: Request) {
  try {
    const s = await getPricingSession()
    await requirePricingPermission(s, 'finance')
    const body = z
      .object({
        policy: quotePolicySchema.strict(),
        expectedRevision: z.number().int().nonnegative(),
        reason: z.string().trim().min(15).max(2000)
      })
      .strict()
      .parse(await readPrivateJsonBody(request, 32768))
    const { data, error } = await s.client.rpc('update_quote_policy_v2', {
      p_policy: body.policy as unknown as Json,
      p_expected_revision: body.expectedRevision,
      p_reason: body.reason
    })
    if (error) throwPricingDatabaseError(error)
    return privateJson(data)
  } catch (error) {
    return pricingError(error)
  }
}
