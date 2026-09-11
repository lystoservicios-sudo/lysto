import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPricingSession, pricingError } from '@/lib/pricing/server'

export async function POST(request: Request) {
  try {
    const s = await getPricingSession()
    const { quoteId } = z.object({ quoteId: z.string().uuid() }).strict().parse(await request.json())
    const { data, error } = await s.client.rpc('submit_service_quote', { p_quote_id: quoteId })
    if (error) throw new Error(error.message.includes('expired') ? 'quote_expired' : 'quote_requires_review')
    return NextResponse.json({ accepted: true, result: data })
  } catch (error) { return pricingError(error) }
}
