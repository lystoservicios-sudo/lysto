import { privateJson } from '@/lib/http/api-error'
import { z } from 'zod'
import { getPricingSession, pricingError } from '@/lib/pricing/server'
export async function GET(request: Request) {
  try {
    const s = await getPricingSession()
    const params = new URL(request.url).searchParams
    const jobId = params.get('jobId')
    const requestId = params.get('requestId')
    const id = z
      .string()
      .uuid()
      .parse(jobId ?? requestId)
    const { data: job, error } = await s.client
      .from('jobs')
      .select('*')
      .eq(jobId ? 'id' : 'request_id', id)
      .single()
    if (error || !job)
      return privateJson(
        { error: 'No encontramos un trabajo disponible para tu cuenta.' },
        { status: 404 }
      )
    const { data: savedQuote } = await s.client
      .from('service_quotes')
      .select('*')
      .eq('request_id', job.request_id)
      .single()
    const { data: extras } = await s.client
      .from('job_extras')
      .select('*')
      .eq('job_id', job.id)
      .order('created_at')
    const { data: serviceRequest } = await s.client
      .from('service_requests')
      .select('equipment_id')
      .eq('id', job.request_id)
      .single()
    const onsite = await s.client
      .from('onsite_diagnoses')
      .select('*')
      .eq('job_id', job.id)
      .maybeSingle()
    return privateJson({
      job,
      savedQuote,
      extras: extras ?? [],
      onsiteDiagnosis: onsite.data ?? null,
      equipmentId: serviceRequest?.equipment_id ?? null,
      role: s.role
    })
  } catch (error) {
    return pricingError(error)
  }
}
