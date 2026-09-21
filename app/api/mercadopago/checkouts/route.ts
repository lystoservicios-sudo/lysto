import { privateJson } from '@/lib/http/api-error'
import { z } from 'zod'
import { paymentActor,visibleCheckout } from '@/lib/payments/marketplace-session'
import { paymentDatabase } from '@/lib/payments/marketplace-db'
import { paymentError,sameOrigin } from '@/lib/payments/marketplace-config'
import { reconcileCheckout, renewCheckout } from '@/lib/payments/marketplace'
export const runtime='nodejs'
const legacyCheckoutListSql=`select c.id,c.job_id,c.extra_id,c.amount,c.marketplace_fee,c.professional_amount,c.status,c.live_mode,c.expires_at,c.review_reason,c.created_at,
  coalesce((select jsonb_agg(jsonb_build_object('paymentId',p.provider_payment_id,'status',p.provider_status,'providerFee',p.provider_fee,'netReceived',p.net_received_amount,'refunded',p.refunded_amount)) from public.marketplace_payment_observations p where p.checkout_id=c.id),'[]') as observations
  from public.marketplace_checkouts c where ($1::uuid is null or c.job_id=$1) and ($2::boolean or c.customer_id=$3::uuid or c.professional_id=$4::uuid) order by c.created_at desc limit 100`
export async function GET(request:Request){
  try{
    const actor=await paymentActor(),job=new URL(request.url).searchParams.get('jobId')
    if(job)z.string().uuid().parse(job)
    const db=paymentDatabase(),params=[job,actor.role==='admin',actor.customerId??null,actor.professionalId??null]
    let result
    try{result=await db.query(`select c.id,c.job_id,c.extra_id,c.amount,c.marketplace_fee,c.professional_amount,c.status,c.live_mode,c.expires_at,c.review_reason,c.created_at,c.checkout_protocol,
      case when c.checkout_protocol='orders' then
        coalesce((select jsonb_agg(jsonb_build_object('paymentId',p.payment_id,'status',p.provider_status,'providerFee',null,'netReceived',null,'refunded',p.refunded_amount)) from private.marketplace_order_observations p where p.checkout_id=c.id),'[]'::jsonb)
      else coalesce((select jsonb_agg(jsonb_build_object('paymentId',p.provider_payment_id,'status',p.provider_status,'providerFee',p.provider_fee,'netReceived',p.net_received_amount,'refunded',p.refunded_amount)) from public.marketplace_payment_observations p where p.checkout_id=c.id),'[]'::jsonb) end as observations
      from public.marketplace_checkouts c where ($1::uuid is null or c.job_id=$1) and ($2::boolean or c.customer_id=$3::uuid or c.professional_id=$4::uuid) order by c.created_at desc limit 100`,params)}
    catch(error){
      const code=(error as {code?:string}).code,message=error instanceof Error?error.message:''
      if(!((code==='42703'&&message.includes('checkout_protocol'))||
        (code==='42P01'&&message.includes('marketplace_order_observations'))))throw error
      result=await db.query(legacyCheckoutListSql,params)
    }
    return privateJson({checkouts:result.rows,role:actor.role},{headers:{'Cache-Control':'no-store'}})
  }catch(error){return paymentError(error)}
}
export async function POST(request:Request){
  try{const actor=await paymentActor();sameOrigin(request);const {checkoutId,action}=z.object({checkoutId:z.string().uuid(),action:z.enum(['reconcile','renew']).default('reconcile')}).strict().parse(await request.json());const checkout=await visibleCheckout(checkoutId,actor);if(action==='renew'){if(actor.role!=='admin')throw new Error('forbidden');await renewCheckout(checkout)}else await reconcileCheckout(checkout);return privateJson({updated:true})}
  catch(error){return paymentError(error)}
}
