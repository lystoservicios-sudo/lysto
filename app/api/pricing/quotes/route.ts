import { privateJson } from '@/lib/http/api-error'
import { z } from 'zod'
import { getPricingSession, pricingError, requirePricingPermission } from '@/lib/pricing/server'
export async function GET() {
  try {
    const s = await getPricingSession()
    const { data, error } = await s.client.from('service_quotes').select('*').order('created_at', { ascending: false }).limit(50)
    if (error) throw new Error('pricing_database_not_ready')
    return privateJson({ quotes: data })
  } catch (error) { return pricingError(error) }
}
export async function PATCH(request: Request) {
  try {
    const s = await getPricingSession()
    await requirePricingPermission(s, 'operations')
    const body = z.object({ quoteId: z.string().uuid(), reason: z.string().trim().min(15).max(2000) }).strict().parse(await request.json())
    const { data, error } = await s.client.rpc('review_service_quote', { p_quote_id: body.quoteId, p_reason: body.reason })
    if (error) throw new Error(error.message.includes('expired') ? 'quote_expired' : 'quote_requires_review')
    return privateJson({ result: data })
  } catch (error) { return pricingError(error) }
}
