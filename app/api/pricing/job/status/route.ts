import { privateJson } from '@/lib/http/api-error'
import { z } from 'zod'
import { getPricingSession, pricingError } from '@/lib/pricing/server'
export async function POST(request:Request){
  try {
    const s=await getPricingSession()
    if(s.role!=='professional')throw new Error('forbidden')
    const {jobId,expectedStatus}=z.object({jobId:z.string().uuid(),expectedStatus:z.enum(['confirmed','technician_on_way','arrived','onsite_diagnosis'])}).strict().parse(await request.json())
    const {data,error}=await s.client.rpc('advance_service_job',{p_job_id:jobId,p_expected_status:expectedStatus})
    if(error)throw new Error(error.message==='Initial payment must be approved before the visit'?'initial_payment_required':'job_transition_unavailable')
    return privateJson({result:data})
  }catch(error){return pricingError(error)}
}
