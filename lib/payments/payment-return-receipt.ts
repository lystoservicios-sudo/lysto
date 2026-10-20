import 'server-only'
import { z } from 'zod'
import { ApiError } from '@/lib/http/api-error'
import { paymentDatabase } from './marketplace-db'
import { checkPaymentReturnToken } from './payment-return-token'

const receiptSchema = z.object({
  id: z.string().uuid(), jobId: z.string().uuid(), status: z.string(),
  amount: z.coerce.number().finite().nonnegative(), lystoFee: z.coerce.number().finite().nonnegative(),
  liveMode: z.boolean(), extraId: z.string().uuid().nullable(), extraLabel: z.string().nullable(),
  service: z.string(), professional: z.string(), scheduledDate: z.string().nullable(),
  timeWindow: z.string().nullable(), providerReferences: z.array(z.string()).max(100),
  expiresAt: z.string()
}).strict()

// Intentionally does not expose account IDs, addresses, contact information,
// other payments, refund requests or service-record sharing tokens.
const receiptSql = `select jsonb_build_object(
  'id',c.id,'jobId',c.job_id,'status',c.status,'amount',c.amount,'lystoFee',c.marketplace_fee,
  'liveMode',c.live_mode,'extraId',c.extra_id,'extraLabel',e.fault,
  'service',coalesce(i.name,'Servicio técnico'),
  'professional',coalesce(nullif(trim(concat(p.first_name,' ',left(p.last_name,1))),''),'Profesional por confirmar'),
  'scheduledDate',j.scheduled_date,'timeWindow',j.scheduled_time_window,'expiresAt',c.expires_at,
  'providerReferences',coalesce((select jsonb_agg(ob.payment_id order by ob.payment_id) from (
    select o.provider_payment_id as payment_id from public.marketplace_payment_observations o
      where o.checkout_id=c.id and o.issues='[]'::jsonb and c.checkout_protocol='preferences'
      and o.provider_status in ('approved','refunded','partially_refunded')
    union select o.payment_id from private.marketplace_order_observations o
      where o.checkout_id=c.id and o.payment_id is not null and o.issues='[]'::jsonb and c.checkout_protocol='orders'
      and o.provider_status in ('approved','refunded','partially_refunded')
  ) ob),'[]'::jsonb)
) as data from public.marketplace_checkouts c
join public.jobs j on j.id=c.job_id and j.customer_id=c.customer_id
join public.service_requests r on r.id=j.request_id and r.customer_id=c.customer_id
left join public.job_extras e on e.id=c.extra_id and e.job_id=c.job_id
left join public.service_issue_types i on i.id=r.issue_type_id
left join public.professional_profiles pro on pro.id=c.professional_id
left join public.profiles p on p.id=pro.profile_id
where c.id=$1::uuid`

export async function readPaymentReturnReceipt(checkoutId: string, token: string, key: string) {
  if (!checkPaymentReturnToken(checkoutId, token, key)) throw new ApiError('forbidden')
  const result = await paymentDatabase().query(receiptSql, [checkoutId])
  return result.rows[0]?.data ? receiptSchema.parse(result.rows[0].data) : null
}
