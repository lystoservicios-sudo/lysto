import { privateJson } from '@/lib/http/api-error'
import { z } from 'zod'
import { getPricingSession, pricingError, throwPricingDatabaseError } from '@/lib/pricing/server'

const visitSchema = z
  .object({
    scheduleVersion: z.number().int().positive(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    timezone: z.literal('America/Argentina/Buenos_Aires'),
    addressLabel: z.string().trim().min(1).max(500),
    professionalName: z.string().trim().min(1).max(160),
    durationMinutes: z.number().int().min(30).max(480),
    travelBufferMinutes: z.number().int().min(0).max(180),
    confirmed: z.literal(true)
  })
  .strict()
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
    const visitResult = await s.client.rpc('get_job_visit', { p_job_id: job.id })
    if (visitResult.error) throwPricingDatabaseError(visitResult.error)
    const visit = visitSchema.nullable().parse(visitResult.data)
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
    const finalReport = await s.client
      .from('job_final_reports')
      .select(
        'id,job_id,equipment_id,real_diagnosis,work_done,parts_used,final_state,maintenance_option,next_maintenance_date,warranty_days,after_photo_ids,version,created_at'
      )
      .eq('job_id', job.id)
      .maybeSingle()
    return privateJson({
      job,
      savedQuote,
      extras: extras ?? [],
      onsiteDiagnosis: onsite.data ?? null,
      finalReport: finalReport.data ?? null,
      equipmentId: serviceRequest?.equipment_id ?? null,
      visit,
      role: s.role
    })
  } catch (error) {
    return pricingError(error)
  }
}
