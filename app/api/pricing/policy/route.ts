import { NextResponse } from 'next/server'
import type { Json } from '@/lib/supabase/database.types'
import { quotePolicySchema } from '@/lib/pricing/service-quote'
import { getPricingSession, getQuotePolicy, pricingError } from '@/lib/pricing/server'
export async function GET() {
  try { const s = await getPricingSession(); return NextResponse.json({ policy: await getQuotePolicy(s.client) }) }
  catch (error) { return pricingError(error) }
}
export async function PUT(request: Request) {
  try {
    const s = await getPricingSession()
    if (s.role !== 'admin') throw new Error('forbidden')
    const policy = quotePolicySchema.parse(await request.json())
    const { error } = await s.client.rpc('update_quote_policy', { p_policy: policy as unknown as Json })
    if (error) throw new Error('forbidden')
    return NextResponse.json({ policy })
  } catch (error) { return pricingError(error) }
}
