import 'server-only'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
import { paymentDatabase } from '@/lib/payments/marketplace-db'
import { paymentListInput, paymentRecordAvailable, type PaymentRecord } from './payments-model'

const uuid = z.string().uuid()
const money = z.coerce.number().finite().nonnegative()
const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)))
const refundSchema = z.object({
  id: uuid, amount: money, status: z.string(), reason: z.string(),
  requestedAt: timestamp, updatedAt: timestamp, providerReference: z.string().nullable()
}).strict()
const checkoutSchema = z.object({
  id: uuid, extraId: uuid.nullable(), extraLabel: z.string().nullable(), amount: money,
  currency: z.literal('ARS'), status: z.string(), liveMode: z.boolean(), closedForNewPayments: z.boolean().optional(),
  createdAt: timestamp, updatedAt: timestamp, expiresAt: timestamp,
  refundedAmount: money, providerReferences: z.array(z.string()).max(100),
  refunds: z.array(refundSchema).max(100)
}).strict()
const detailSchema = z.object({
  id: uuid, status: z.string(), service: z.string(), professional: z.string(),
  amount: money.nullable(), canStartPayment: z.boolean().optional(), scheduledDate: z.string().nullable(), timeWindow: z.string().nullable(),
  createdAt: timestamp,
  extras: z.array(z.object({ id: uuid, fault: z.string(), amount: money, status: z.string() }).strict()).max(500),
  checkouts: z.array(checkoutSchema).max(500),
  serviceReceipt: z.object({ token: uuid }).strict().nullable()
}).strict()
const movementSchema = z.object({
  id: z.string(), jobId: uuid, checkoutId: uuid.nullable(), extraLabel: z.string().nullable(),
  service: z.string(), professional: z.string(), amount: money, status: z.string().nullable(),
  liveMode: z.boolean().nullable(), createdAt: timestamp, expiresAt: timestamp.nullable(), hasRefund: z.boolean()
}).strict()
const pageSchema = z.object({ items: z.array(movementSchema).max(20), total: z.coerce.number().int().nonnegative() }).strict()
export type CustomerPaymentDetail = z.infer<typeof detailSchema>
export type CustomerPaymentMovement = z.infer<typeof movementSchema>

function customerAuthority(session: Session) {
  if (session.role !== 'customer' || !uuid.safeParse(session.customerId).success) throw new ApiError('forbidden')
  return session.customerId!
}

const ownedTargetsSql = `with owned_jobs as (
  select j.id,j.status,j.created_at,j.request_id,j.professional_id,
    coalesce((q.quote->>'total')::numeric,j.final_amount) as initial_amount,
    q.id as quote_id,coalesce(i.name,'Servicio técnico') as service,
    coalesce(nullif(trim(concat(p.first_name,' ',left(p.last_name,1))),''),'Profesional por confirmar') as professional
  from public.jobs j
  join public.service_requests r on r.id=j.request_id and r.customer_id=$1::uuid
  left join public.service_issue_types i on i.id=r.issue_type_id
  left join public.professional_profiles pro on pro.id=j.professional_id
  left join public.profiles p on p.id=pro.profile_id
  left join lateral (select sq.id,sq.quote from public.service_quotes sq
    where sq.request_id=j.request_id and sq.customer_id=$1::uuid and sq.accepted_at is not null
    order by sq.accepted_at desc,sq.id desc limit 1) q on true
  where j.customer_id=$1::uuid
), targets as (
  select j.id as job_id,null::uuid as extra_id,null::text as extra_label,j.initial_amount as target_amount,
    j.service,j.professional,j.created_at,j.status as job_status,j.quote_id
  from owned_jobs j
  union all
  select j.id,e.id,e.fault,e.amount,j.service,j.professional,e.created_at,j.status,j.quote_id
  from owned_jobs j join public.job_extras e on e.job_id=j.id and e.status='accepted'
), movements as (
  select coalesce(c.id::text,'due-'||t.job_id::text||coalesce('-'||t.extra_id::text,'')) as id,
    t.job_id,t.extra_id,t.extra_label,t.service,t.professional,
    coalesce(c.amount,t.target_amount) as amount,c.status,c.live_mode,
    coalesce(c.created_at,t.created_at) as created_at,c.id as checkout_id,c.expires_at,
    (c.status in ('refunded','partially_refunded') or exists(
      select 1 from private.payment_refund_requests pr
      join public.payments p on p.id=pr.payment_id and p.customer_id=$1::uuid and p.job_id=t.job_id
      where exists(select 1 from public.marketplace_payment_observations o where o.checkout_id=c.id and o.provider_payment_id=p.provider_payment_id)
         or exists(select 1 from private.marketplace_order_observations o where o.checkout_id=c.id and o.payment_id=p.provider_payment_id)
    )) as has_refund
  from targets t left join public.marketplace_checkouts c on c.job_id=t.job_id
    and c.extra_id is not distinct from t.extra_id and c.customer_id=$1::uuid
  where c.id is not null or (t.quote_id is not null and t.target_amount>0
    and t.job_status not in ('pending_assignment','pending_professional_acceptance','cancelled_by_customer','cancelled_by_professional','cancelled_by_admin'))
)`

const listSql = `${ownedTargetsSql}, filtered as (
  select id,job_id,extra_label,service,professional,amount,status,live_mode,created_at,checkout_id,expires_at,coalesce(has_refund,false) as has_refund
  from movements m where $2::text='todos'
    or ($2='pendientes' and (status is null or status in ('ready','creating','rejected','cancelled','expired'))
      and not exists(select 1 from public.marketplace_checkouts settled where settled.job_id=m.job_id
        and settled.extra_id is not distinct from m.extra_id and settled.customer_id=$1::uuid
        and settled.status in ('approved','pending','in_process','review','refunded','partially_refunded','charged_back')))
    or ($2='procesando' and status in ('pending','in_process','review'))
    or ($2='pagados' and status in ('approved','refunded','partially_refunded'))
    or ($2='reintegros' and has_refund)
), paged as (
  select id,job_id,extra_label,service,professional,amount,status,live_mode,created_at,checkout_id,expires_at,has_refund
  from filtered order by created_at desc,id desc limit $3::int offset $4::int
)
select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce((
  select jsonb_agg(jsonb_build_object('id',id,'jobId',job_id,'checkoutId',checkout_id,'extraLabel',extra_label,
    'service',service,'professional',professional,'amount',amount,'status',status,'liveMode',live_mode,
    'createdAt',created_at,'expiresAt',expires_at,'hasRefund',has_refund) order by created_at desc,id desc) from paged
),'[]'::jsonb)) as data`

/** Explicit, authenticated customer predicates also guard private ledger reads. Never calls the provider. */
export async function listCustomerPayments(session: Session, input: Record<string, string | string[] | undefined> = {}) {
  const customerId = customerAuthority(session)
  const options = paymentListInput(input)
  const result = await paymentDatabase().query(listSql, [customerId, options.filter, options.pageSize, (options.page - 1) * options.pageSize])
  const data = pageSchema.parse(result.rows[0]?.data)
  return { ...data, ...options, hasNext: options.page * options.pageSize < data.total, hasPrevious: options.page > 1 }
}

const detailSql = `select jsonb_build_object(
  'id',j.id,'status',j.status,'service',coalesce(i.name,'Servicio técnico'),
  'professional',coalesce(nullif(trim(concat(p.first_name,' ',left(p.last_name,1))),''),'Profesional por confirmar'),
  'amount',coalesce((q.quote->>'total')::numeric,j.final_amount),
  'canStartPayment',q.quote is not null and r.status not in ('expired','cancelled') and not exists(
    select 1 from private.financial_exception_cases f where f.job_id=j.id and f.status in ('waiting_reconciliation','ready')),
  'scheduledDate',j.scheduled_date,'timeWindow',j.scheduled_time_window,'createdAt',j.created_at,
  'extras',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'fault',e.fault,'amount',e.amount,'status',e.status)
    order by e.created_at,e.id) from public.job_extras e where e.job_id=j.id),'[]'::jsonb),
  'checkouts',coalesce((select jsonb_agg(jsonb_build_object(
    'id',c.id,'extraId',c.extra_id,'extraLabel',e.fault,'amount',c.amount,'currency',c.currency,'status',c.status,
    'liveMode',c.live_mode,'closedForNewPayments',c.closed_for_new_payments_at is not null,
    'createdAt',c.created_at,'updatedAt',c.updated_at,'expiresAt',c.expires_at,
    'refundedAmount',coalesce((select sum(ob.refunded_amount) from (
      select o.refunded_amount from public.marketplace_payment_observations o where o.checkout_id=c.id and o.issues='[]'::jsonb and c.checkout_protocol='preferences'
      union all select o.refunded_amount from private.marketplace_order_observations o where o.checkout_id=c.id and o.issues='[]'::jsonb and c.checkout_protocol='orders'
    ) ob),0),
    'providerReferences',coalesce((select jsonb_agg(ob.payment_id order by ob.payment_id) from (
      select o.provider_payment_id as payment_id from public.marketplace_payment_observations o where o.checkout_id=c.id and o.issues='[]'::jsonb and c.checkout_protocol='preferences'
        and o.provider_status in ('approved','refunded','partially_refunded')
      union select o.payment_id from private.marketplace_order_observations o where o.checkout_id=c.id and o.payment_id is not null and o.issues='[]'::jsonb and c.checkout_protocol='orders'
        and o.provider_status in ('approved','refunded','partially_refunded')
    ) ob),'[]'::jsonb),
    'refunds',coalesce((select jsonb_agg(jsonb_build_object('id',pr.id,'amount',pr.amount,'status',pr.status,'reason',pr.reason,
      'requestedAt',pr.requested_at,'updatedAt',pr.updated_at,'providerReference',pr.provider_reference) order by pr.requested_at desc,pr.id desc)
      from private.payment_refund_requests pr join public.payments p on p.id=pr.payment_id and p.customer_id=$1::uuid and p.job_id=j.id
      where exists(select 1 from public.marketplace_payment_observations o where o.checkout_id=c.id and o.provider_payment_id=p.provider_payment_id)
         or exists(select 1 from private.marketplace_order_observations o where o.checkout_id=c.id and o.payment_id=p.provider_payment_id)
    ),'[]'::jsonb)
  ) order by c.created_at desc,c.id desc) from public.marketplace_checkouts c
    left join public.job_extras e on e.id=c.extra_id and e.job_id=j.id
    where c.job_id=j.id and c.customer_id=$1::uuid),'[]'::jsonb),
  'serviceReceipt',(select jsonb_build_object('token',r.public_token) from public.receipts r
    where r.job_id=j.id and r.revoked_at is null and r.expires_at>clock_timestamp()
    order by r.created_at desc,r.id desc limit 1)
) as data
from public.jobs j
join public.service_requests r on r.id=j.request_id and r.customer_id=$1::uuid
left join public.service_issue_types i on i.id=r.issue_type_id
left join public.professional_profiles pro on pro.id=j.professional_id
left join public.profiles p on p.id=pro.profile_id
left join lateral (select sq.quote from public.service_quotes sq
  where sq.request_id=j.request_id and sq.customer_id=$1::uuid and sq.accepted_at is not null
  order by sq.accepted_at desc,sq.id desc limit 1) q on true
where j.customer_id=$1::uuid and j.id=$2::uuid`

export async function readCustomerPaymentDetail(session: Session, id: string): Promise<CustomerPaymentDetail | null> {
  const customerId = customerAuthority(session)
  if (!uuid.safeParse(id).success) return null
  const result = await paymentDatabase().query(detailSql, [customerId, id])
  return result.rows[0]?.data ? detailSchema.parse(result.rows[0].data) : null
}
export async function readCustomerPaymentRecord(session: Session, id: string, checkoutId: string): Promise<PaymentRecord | null> {
  customerAuthority(session)
  if (!uuid.safeParse(checkoutId).success) return null
  const detail = await readCustomerPaymentDetail(session, id)
  const checkout = detail?.checkouts.find((item) => item.id === checkoutId)
  if (!detail || !checkout || !paymentRecordAvailable(checkout)) return null
  return {
    jobId: detail.id, checkoutId: checkout.id, service: detail.service,
    amount: checkout.amount, refundedAmount: checkout.refundedAmount, status: checkout.status,
    createdAt: checkout.createdAt, updatedAt: checkout.updatedAt,
    providerReferences: checkout.providerReferences, extraLabel: checkout.extraLabel
  }
}
export async function readCustomerRefund(session: Session, id: string, refundId: string) {
  customerAuthority(session)
  if (!uuid.safeParse(refundId).success) return null
  const detail = await readCustomerPaymentDetail(session, id)
  if (!detail) return null
  for (const checkout of detail.checkouts) {
    const refund = checkout.refunds.find((item) => item.id === refundId)
    if (refund) return { refund, jobId: detail.id, service: detail.service, checkoutId: checkout.id, paymentAmount: checkout.amount }
  }
  return null
}
export async function countPendingCustomerPayments(session: Session): Promise<number> {
  const customerId = customerAuthority(session)
  const result = await paymentDatabase().query(`${ownedTargetsSql}
    select count(*) as count from movements m where (m.status is null or m.status in ('ready','rejected','cancelled'))
    and not exists(select 1 from public.marketplace_checkouts settled where settled.job_id=m.job_id
      and settled.extra_id is not distinct from m.extra_id and settled.customer_id=$1::uuid
      and settled.status in ('approved','pending','in_process','review','refunded','partially_refunded','charged_back'))`, [customerId])
  return z.coerce.number().int().nonnegative().parse(result.rows[0]?.count ?? 0)
}
