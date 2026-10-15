import { ApiError, privateJson } from '@/lib/http/api-error'
import { z } from 'zod'
import { getPricingSession, pricingError, throwPricingDatabaseError } from '@/lib/pricing/server'
import { requestVisitAddress } from '@/lib/jobs/visit-address'

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
    const professionalResult = await s.client.rpc('get_job_professional_name', { p_job_id: job.id })
    if (
      professionalResult.error &&
      !['42883', 'PGRST202'].includes(professionalResult.error.code ?? '')
    )
      throwPricingDatabaseError(professionalResult.error)
    const professionalName = professionalResult.data ?? visit?.professionalName ?? null
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
    const { data: serviceRequest, error: serviceRequestError } = await s.client
      .from('service_requests')
      .select('equipment_id,status,contract_source,visit_address_snapshot')
      .eq('id', job.request_id)
      .single()
    if (serviceRequestError) throwPricingDatabaseError(serviceRequestError)
    if (!serviceRequest) throw new ApiError('service_unavailable')
    let customerService: { issueLabel: string; equipmentName: string | null; addressLabel: string | null } | undefined
    if (s.role === 'customer' && s.customerId) {
      const requestResult = await s.client.from('service_requests')
        .select('issue_type_id,equipment_id,address_id,contract_source,visit_address_snapshot').eq('id', job.request_id).eq('customer_id', s.customerId).maybeSingle()
      if (requestResult.error) throwPricingDatabaseError(requestResult.error)
      const ownedRequest = requestResult.data
      const [equipmentResult, addressResult, issueResult] = await Promise.all([
        ownedRequest?.equipment_id
          ? s.client.from('customer_equipment').select('nickname').eq('id', ownedRequest.equipment_id).eq('customer_id', s.customerId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        ownedRequest?.address_id && ownedRequest.contract_source == null
          ? s.client.from('customer_addresses').select('street,number,floor,apartment,city').eq('id', ownedRequest.address_id).eq('customer_id', s.customerId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        ownedRequest?.issue_type_id
          ? s.client.from('service_issue_types').select('name').eq('id', ownedRequest.issue_type_id).maybeSingle()
          : Promise.resolve({ data: null, error: null })
      ])
      if (equipmentResult.error) throwPricingDatabaseError(equipmentResult.error)
      if (addressResult.error) throwPricingDatabaseError(addressResult.error)
      if (issueResult.error) throwPricingDatabaseError(issueResult.error)
      const address = addressResult.data
      customerService = {
        issueLabel: issueResult.data?.name ?? 'Aire acondicionado',
        equipmentName: equipmentResult.data?.nickname ?? null,
        addressLabel: requestVisitAddress({ contractSource: ownedRequest?.contract_source, visitAddressSnapshot: ownedRequest?.visit_address_snapshot }, address ? [
          [address.street, address.number].filter(Boolean).join(' '),
          [address.floor ? `Piso ${address.floor}` : null, address.apartment ? `Depto. ${address.apartment}` : null].filter(Boolean).join(' '),
          address.city
        ].filter(Boolean).join(', ') : undefined) ?? null
      }
    }
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
      job: { ...job, professionalName, ...(serviceRequest?.contract_source ? {
        contractSource: serviceRequest.contract_source, requestStatus: serviceRequest.status
      } : {}) },
      savedQuote,
      extras: extras ?? [],
      onsiteDiagnosis: onsite.data ?? null,
      finalReport: finalReport.data ?? null,
      equipmentId: serviceRequest?.equipment_id ?? null,
      visit,
      ...(serviceRequest?.contract_source ? {
        visitAddressLabel: requestVisitAddress({ contractSource: serviceRequest.contract_source, visitAddressSnapshot: serviceRequest.visit_address_snapshot }) ?? null
      } : {}),
      ...(customerService ? { customerService } : {}),
      role: s.role
    })
  } catch (error) {
    return pricingError(error)
  }
}
