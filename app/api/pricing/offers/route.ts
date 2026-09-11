import { privateJson } from '@/lib/http/api-error'
import { z } from 'zod'
import { getPricingSession, pricingError, requirePricingPermission } from '@/lib/pricing/server'
export async function GET() {
  try {
    const s = await getPricingSession()
    if (s.role === 'admin') await requirePricingPermission(s, 'operations')
    const { data: jobs, error } = await s.client.from('jobs').select('id,request_id,status,professional_id,scheduled_date').order('created_at', { ascending: false }).limit(50)
    if (error) throw new Error('pricing_database_not_ready')
    const { data: professionals } = s.role === 'admin' ? await s.client.from('professional_profiles').select('id,profiles(first_name,last_name)').eq('status','approved') : { data: [] }
    return privateJson({ jobs, professionals, role: s.role })
  } catch (error) { return pricingError(error) }
}
export async function POST(request: Request) {
  try {
    const s = await getPricingSession()
    if (s.role === 'admin') await requirePricingPermission(s, 'operations')
    else if (s.role !== 'professional') throw new Error('forbidden')
    const body = z.object({ jobId: z.string().uuid(), professionalId: z.string().uuid().optional(), action: z.enum(['assign','accepted','rejected']), reason: z.string().max(1000).optional() }).strict().parse(await request.json())
    if (body.action === 'assign') {
      if (s.role !== 'admin' || !body.professionalId) throw new Error('forbidden')
      const { data: admin } = await s.client.from('admin_profiles').select('id').eq('profile_id',s.profileId).single()
      const { data: job } = await s.client.from('jobs').select('request_id').eq('id',body.jobId).single()
      if (!admin || !job) throw new Error('forbidden')
      const { data, error } = await s.client.rpc('assign_professional_to_job',{ p_job_id:body.jobId,p_request_id:job.request_id,p_professional_id:body.professionalId,p_admin_profile_id:admin.id })
      if (error) throw new Error('offer_unavailable')
      return privateJson({ result:data })
    }
    const { data: pro } = await s.client.from('professional_profiles').select('id').eq('profile_id',s.profileId).single()
    if (s.role !== 'professional' || !pro) throw new Error('forbidden')
    const { data,error } = await s.client.rpc('professional_respond_to_job',{ p_job_id:body.jobId,p_professional_id:pro.id,p_response:body.action,p_reason:body.reason })
    if (error) throw new Error('offer_unavailable')
    return privateJson({ result:data })
  } catch (error) { return pricingError(error) }
}
