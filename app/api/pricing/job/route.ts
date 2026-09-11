import { privateJson } from '@/lib/http/api-error'
import { z } from 'zod'
import { getPricingSession, pricingError } from '@/lib/pricing/server'
export async function GET(request: Request) {
  try {
    const s = await getPricingSession()
    const params = new URL(request.url).searchParams
    const jobId = params.get('jobId'); const requestId = params.get('requestId')
    const id = z.string().uuid().parse(jobId ?? requestId)
    const { data: job, error } = await s.client.from('jobs').select('*').eq(jobId ? 'id' : 'request_id', id).single()
    if (error || !job) return privateJson({ error: 'No encontramos un trabajo disponible para tu cuenta.' }, { status: 404 })
    const { data: savedQuote } = await s.client.from('service_quotes').select('*').eq('request_id', job.request_id).single()
    const { data: extras } = await s.client.from('job_extras').select('*').eq('job_id', job.id).order('created_at')
    return privateJson({ job, savedQuote, extras: extras ?? [], role: s.role })
  } catch (error) { return pricingError(error) }
}
