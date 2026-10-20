import { NextResponse } from 'next/server'
import { getPricingSession } from '@/lib/pricing/server'
import { marketplaceConfig, paymentError, sameOrigin } from '@/lib/payments/marketplace-config'
import { paymentDatabase } from '@/lib/payments/marketplace-db'
import { prepareCheckout } from '@/lib/payments/marketplace-ledger'
import { createCheckoutPreference } from '@/lib/payments/marketplace'
import { applyOwnerMaintenanceTestPrice } from '@/lib/pricing/owner-maintenance-test-price'
import { createOwnerSplitTestJob } from '@/lib/payments/owner-split-test-job'
import { requireNewCheckouts } from '@/lib/release/runtime-switches'
import { enforceRateLimit, RateLimitExceeded, rateLimitResponse, requestSubject } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'
const CUSTOMER_EMAIL = 'quimey_boca@hotmail.com'

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
    const quote = applyOwnerMaintenanceTestPrice({
      currency: 'ARS', total: 0, platformFee: 0, professionalAmount: 0, platformFeeRate: 0.18,
      platformContribution: 0, paymentCostBudget: 0, calculatorSubtotal: 0,
      labor: 0, laborReference: 0, adjustments: [], materialsAmount: 0,
      travel: 0, safetyAmount: 0, safetyRate: 0.3, reviewReasons: [], readyToOffer: true
    }, true)
    const jobId = await createOwnerSplitTestJob({
      actorUserId: session.userId, actorSessionId: session.sessionId,
      customerId, professionalId, quote
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
