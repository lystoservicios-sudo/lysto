import { privateJson } from '@/lib/http/api-error'
import type { Json } from '@/lib/supabase/database.types'
import { quotePolicySchema } from '@/lib/pricing/service-quote'
import { getPricingSession, getQuotePolicy, pricingError, requirePricingPermission } from '@/lib/pricing/server'
export async function GET() {
  try { const s = await getPricingSession(); return privateJson({ policy: await getQuotePolicy(s.client) }) }
  catch (error) { return pricingError(error) }
}
export async function PUT(request: Request) {
  try {
    const s = await getPricingSession()
    await requirePricingPermission(s, 'finance')
    const policy = quotePolicySchema.parse(await request.json())
    const { error } = await s.client.rpc('update_quote_policy', { p_policy: policy as unknown as Json })
    if (error) throw new Error('forbidden')
    return privateJson({ policy })
  } catch (error) { return pricingError(error) }
}
