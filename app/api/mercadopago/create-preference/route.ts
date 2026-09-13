import { privateJson } from '@/lib/http/api-error'
import { z } from 'zod'
import { getPricingSession } from '@/lib/pricing/server'
import { marketplaceConfig, paymentError, sameOrigin } from '@/lib/payments/marketplace-config'
import { prepareCheckout } from '@/lib/payments/marketplace-ledger'
import { createCheckoutPreference } from '@/lib/payments/marketplace'
import { requireNewCheckouts } from '@/lib/release/runtime-switches'
import {
  enforceRateLimit,
  RateLimitExceeded,
  rateLimitResponse,
  requestSubject
} from '@/lib/security/rate-limit'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    const session = await getPricingSession()
    if (session.role !== 'customer' || !session.customerId) throw new Error('payment_forbidden')
    sameOrigin(request)
    requireNewCheckouts()
    await enforceRateLimit('private_mutation', `${session.profileId}:${requestSubject(request)}`)
    const body = z
      .object({ jobId: z.string().uuid(), extraId: z.string().uuid().optional() })
      .strict()
      .parse(await request.json())
    const config = marketplaceConfig()
    const checkout = await prepareCheckout(
      session.customerId,
      body.jobId,
      body.extraId,
      config.liveMode
    )
    if (checkout.status === 'approved')
      return privateJson({ checkoutId: checkout.id, status: checkout.status })
    const result = await createCheckoutPreference(checkout)
    const initPoint = config.liveMode ? result.init_point : result.sandbox_init_point
    if (!initPoint) throw new Error('invalid_provider_response')
    return privateJson({ checkoutId: result.id, status: result.status, initPoint })
  } catch (error) {
    return error instanceof RateLimitExceeded ? rateLimitResponse(error) : paymentError(error)
  }
}
