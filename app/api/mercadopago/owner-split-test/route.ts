import { NextResponse } from 'next/server'
import { getPricingSession } from '@/lib/pricing/server'
import { marketplaceConfig, paymentError, sameOrigin } from '@/lib/payments/marketplace-config'
import { paymentDatabase, paymentTransaction } from '@/lib/payments/marketplace-db'
import { prepareCheckout } from '@/lib/payments/marketplace-ledger'
import { createCheckoutPreference } from '@/lib/payments/marketplace'
import { applyOwnerMaintenanceTestPrice } from '@/lib/pricing/owner-maintenance-test-price'
import { requireNewCheckouts } from '@/lib/release/runtime-switches'
import { enforceRateLimit, RateLimitExceeded, rateLimitResponse, requestSubject } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'
const CUSTOMER_EMAIL = 'quimey_boca@hotmail.com'
const TOTAL = 1000
const PLATFORM_FEE = 180

export async function POST(request: Request) {
  let stage = 'session'
  try {
    const session = await getPricingSession()
    if (session.role !== 'customer' || !session.customerId) throw new Error('payment_forbidden')
    sameOrigin(request)
    requireNewCheckouts()
    await enforceRateLimit('private_mutation', `${session.profileId}:${requestSubject(request)}`)

    const profile = await session.client.from('profiles').select('email').eq('id', session.profileId).single()
    if (profile.error || profile.data.email?.trim().toLowerCase() !== CUSTOMER_EMAIL) throw new Error('payment_forbidden')
    const config = marketplaceConfig()
    if (!config.liveMode) throw new Error('payment_mode_mismatch')

    stage = 'seller'
    const sellers = await paymentDatabase().query<{ professional_id: string }>(`
      select p.id as professional_id from public.professional_profiles p
      join public.mp_split_connected_accounts a on a.seller_id=p.id::text
      where p.status='approved' and a.enabled and a.mercado_pago_user_id is not null limit 2`)
    if (sellers.rows.length !== 1) throw new Error('test_seller_not_unique')
    const professionalId = sellers.rows[0].professional_id

    stage = 'create_test_job'
    const jobId = await paymentTransaction(async db => {
      await db.query('select pg_advisory_xact_lock(hashtext($1))', [`lysto-split-test:${session.customerId}`])
      const existing = await db.query<{ job_id: string }>(`
        select j.id as job_id from public.request_answers a
        join public.service_requests r on r.id=a.request_id
        join public.jobs j on j.request_id=r.id
        where r.customer_id=$1 and a.question_code='owner_marketplace_split_test'
          and a.answer_json->>'seller_id'=$2 limit 1`, [session.customerId, professionalId])
      if (existing.rows[0]) return existing.rows[0].job_id

      const kind = await db.query<{ category_id: string; issue_type_id: string }>(`
        select c.id as category_id, i.id as issue_type_id from public.service_categories c
        join public.service_issue_types i on i.category_id=c.id
        where c.active and i.active and i.slug='mantenimiento' order by c.slug limit 1`)
      if (!kind.rows[0]) throw new Error('test_service_unavailable')
      const req = await db.query<{ id: string }>(`
        insert into public.service_requests(customer_id,category_id,issue_type_id,status,submitted_at)
        values($1,$2,$3,'assigned',now()) returning id`,
        [session.customerId, kind.rows[0].category_id, kind.rows[0].issue_type_id])
      const requestId = req.rows[0].id
      await db.query(`insert into public.request_answers(request_id,question_code,answer_value,answer_json)
        values($1,'owner_marketplace_split_test','Prueba real de split',jsonb_build_object('seller_id',$2))`, [requestId, professionalId])
      const quote = applyOwnerMaintenanceTestPrice({
        total: TOTAL, platformFee: PLATFORM_FEE, professionalAmount: 820, platformFeeRate: 0.18,
        platformContribution: PLATFORM_FEE, paymentCostBudget: 0, calculatorSubtotal: 769.23,
        labor: 769.23, laborReference: 769.23, adjustments: [], materialsAmount: 0,
        travel: 0, safetyAmount: 230.77, safetyRate: 0.3, reviewReasons: [], readyToOffer: true
      }, true)
      await db.query(`insert into public.service_quotes(customer_id,address,input,quote,preferred_date,time_window,status,expires_at,request_id,accepted_at)
        values($1,'{"label":"Prueba de pago"}'::jsonb,'{"issue":"mantenimiento"}'::jsonb,$2::jsonb,current_date+1,'Horario de prueba','accepted',now()+interval '7 days',$3,now())`,
        [session.customerId, JSON.stringify(quote), requestId])
      const job = await db.query<{ id: string }>(`insert into public.jobs(request_id,customer_id,professional_id,status,accepted_at)
        values($1,$2,$3,'confirmed',now()) returning id`, [requestId, session.customerId, professionalId])
      return job.rows[0].id
    })

    stage = 'prepare_checkout'
    const checkout = await prepareCheckout(session.customerId, jobId, undefined, config.liveMode)
    if (checkout.status === 'approved') return NextResponse.json({ status: 'approved' }, { headers: { 'Cache-Control': 'no-store' } })
    stage = 'mercado_pago_preference'
    const result = await createCheckoutPreference(checkout)
    if (result.status !== 'ready') throw new Error('checkout_review')
    const initPoint = result.checkout_protocol === 'orders' ? result.checkout_url : result.init_point
    if (!initPoint) throw new Error('invalid_provider_response')
    return NextResponse.json({ initPoint }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error(JSON.stringify({ event: 'owner_split_test_checkout_failed', stage,
      code: error instanceof Error ? error.message.slice(0, 100) : 'unknown' }))
    return error instanceof RateLimitExceeded ? rateLimitResponse(error) : paymentError(error)
  }
}
