import { privateJson } from '@/lib/http/api-error'
import { z } from 'zod'
import { getPricingSession, pricingError } from '@/lib/pricing/server'

export async function POST(request: Request) {
  try {
    const s = await getPricingSession()
    if (s.role !== 'customer' || !s.customerId) throw new Error('forbidden')
    const { quoteId } = z.object({ quoteId: z.string().uuid() }).strict().parse(await request.json())
    const { data, error } = await s.client.rpc('submit_service_quote', { p_quote_id: quoteId })
    if (error) throw new Error(error.message.includes('expired') ? 'quote_expired' : 'quote_requires_review')
    return privateJson({ accepted: true, result: data })
  } catch (error) { return pricingError(error) }
}
