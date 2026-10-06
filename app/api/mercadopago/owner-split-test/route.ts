import { NextResponse } from 'next/server'
import { getPricingSession } from '@/lib/pricing/server'
import { marketplaceConfig, paymentError, sameOrigin } from '@/lib/payments/marketplace-config'
import { paymentDatabase, paymentTransaction } from '@/lib/payments/marketplace-db'
import { prepareCheckout } from '@/lib/payments/marketplace-ledger'
import { createCheckoutPreference } from '@/lib/payments/marketplace'
import { applyOwnerMaintenanceTestPrice } from '@/lib/pricing/owner-maintenance-test-price'
import { quoteWriter } from '@/lib/pricing/server'
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
    const customerId = session.customerId
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
      await db.query('select pg_advisory_xact_lock(hashtext($1))', [`lysto-split-test:${customerId}`])
      const existing = await db.query<{ request_id: string; job_id: string | null }>(`
        select r.id as request_id,j.id as job_id from public.request_answers a
        join public.service_requests r on r.id=a.request_id
        left join public.jobs j on j.request_id=r.id
        where r.customer_id=$1 and a.question_code='owner_marketplace_split_test'
          and a.answer_json->>'seller_id'=$2 limit 1`, [customerId, professionalId])
      if (existing.rows[0]?.job_id) return existing.rows[0].job_id

      const writer = quoteWriter()
      let requestId = existing.rows[0]?.request_id
      if (!requestId) {
        const kind = await db.query<{ category_id: string; issue_type_id: string }>(`
          select c.id as category_id, i.id as issue_type_id from public.service_categories c
          join public.service_issue_types i on i.category_id=c.id
          where c.active and i.active and i.slug='mantenimiento' order by c.slug limit 1`)
        if (!kind.rows[0]) throw new Error('test_service_unavailable')
        const req = await writer.from('service_requests').insert({
          customer_id: customerId, category_id: kind.rows[0].category_id,
          issue_type_id: kind.rows[0].issue_type_id, status: 'assigned', submitted_at: new Date().toISOString()
        }).select('id').single()
        if (req.error) throw new Error(`test_request:${req.error.code ?? 'write_failed'}`)
        requestId = req.data.id
        const answer = await writer.from('request_answers').insert({
          request_id: requestId, question_code: 'owner_marketplace_split_test',
          answer_value: 'Prueba real de split', answer_json: { seller_id: professionalId }
        })
        if (answer.error) throw new Error(`test_marker:${answer.error.code ?? 'write_failed'}`)
      }
      if (!requestId) throw new Error('test_request_missing')
      const ensuredRequestId = requestId
      const quote = applyOwnerMaintenanceTestPrice({
        total: TOTAL, platformFee: PLATFORM_FEE, professionalAmount: 820, platformFeeRate: 0.18,
        platformContribution: PLATFORM_FEE, paymentCostBudget: 0, calculatorSubtotal: 769.23,
        labor: 769.23, laborReference: 769.23, adjustments: [], materialsAmount: 0,
        travel: 0, safetyAmount: 230.77, safetyRate: 0.3, reviewReasons: [], readyToOffer: true
      }, true)
      const savedQuote = await db.query<{ id: string }>(`select id from public.service_quotes where request_id=$1`, [ensuredRequestId])
      if (!savedQuote.rows[0]) {
        const insertedQuote = await writer.from('service_quotes').insert({
          customer_id: customerId, address: { label: 'Prueba de pago' },
          input: { issue: 'mantenimiento', marketplaceSplitTest: true }, quote,
          preferred_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
          time_window: 'Horario de prueba', status: 'accepted',
          expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
          request_id: ensuredRequestId, accepted_at: new Date().toISOString(), created_by: session.profileId
        })
        if (insertedQuote.error) throw new Error(`test_quote:${insertedQuote.error.code ?? 'write_failed'}`)
      }
      const savedJob = await db.query<{ id: string }>('select id from public.jobs where request_id=$1', [ensuredRequestId])
      if (savedJob.rows[0]) return savedJob.rows[0].id
      const insertedJob = await writer.from('jobs').insert({
        request_id: ensuredRequestId, customer_id: customerId, professional_id: professionalId,
        status: 'confirmed', accepted_at: new Date().toISOString()
      }).select('id').single()
      if (insertedJob.error) throw new Error(`test_job:${insertedJob.error.code ?? 'write_failed'}`)
      return insertedJob.data.id
    })

    stage = 'prepare_checkout'
    const checkout = await prepareCheckout(customerId, jobId, undefined, config.liveMode)
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
