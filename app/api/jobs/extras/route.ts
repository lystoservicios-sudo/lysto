import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPricingSession, pricingError } from '@/lib/pricing/server'
export async function GET(request: Request) {
  try {
    const s = await getPricingSession()
    const jobId = z.string().uuid().parse(new URL(request.url).searchParams.get('jobId'))
    const { data, error } = await s.client.from('job_extras').select('*').eq('job_id', jobId).order('created_at')
    if (error) throw new Error('pricing_database_not_ready')
    return NextResponse.json({ extras: data })
  } catch (error) { return pricingError(error) }
}
export async function POST(request: Request) {
  try {
    const s = await getPricingSession()
    const b = z.object({ jobId: z.string().uuid(), fault: z.string().trim().min(5).max(500), description: z.string().trim().min(10).max(2000), amount: z.number().finite().positive().max(100_000_000).multipleOf(0.01), idempotencyKey: z.string().uuid() }).strict().parse(await request.json())
    const { data, error } = await s.client.rpc('propose_job_extra', { p_job_id: b.jobId, p_fault: b.fault, p_description: b.description, p_amount: b.amount, p_idempotency_key: b.idempotencyKey })
    if (error) throw new Error('extra_unavailable')
    return NextResponse.json({ extra: data })
  } catch (error) { return pricingError(error) }
}
export async function PATCH(request: Request) {
  try {
    const s = await getPricingSession()
    const b = z.object({ extraId: z.string().uuid(), decision: z.enum(['accepted', 'rejected']) }).strict().parse(await request.json())
    const { data, error } = await s.client.rpc('decide_job_extra', { p_extra_id: b.extraId, p_decision: b.decision })
    if (error) throw new Error('extra_unavailable')
    return NextResponse.json({ extra: data })
  } catch (error) { return pricingError(error) }
}
