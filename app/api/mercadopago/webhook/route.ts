import { NextResponse } from 'next/server'
import { handleMarketplaceIpn, handleMarketplaceWebhook } from '@/lib/payments/marketplace'
import { InvalidWebhookSignatureError, ValidationError } from '@waltergaltieri/mercadopago-split'
import { InvalidOrderWebhookSignatureError } from '@/lib/payments/orders'
import {
  enforceRateLimit,
  RateLimitExceeded,
  rateLimitResponse,
  requestSubject
} from '@/lib/security/rate-limit'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 65536)
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    const text = await request.text()
    if (text.length > 65536)
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    const params = new URL(request.url).searchParams
    if ([...new Set(params.keys())].some((key) => params.getAll(key).length > 1))
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
    await enforceRateLimit('webhook', requestSubject(request))
    if (params.get('source_news') === 'ipn') {
      const checkoutId = params.get('checkout') ?? ''
      const token = params.get('token') ?? ''
      const topic = params.get('topic') ?? ''
      const resourceId = params.get('id') ?? ''
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(checkoutId) ||
        !/^[0-9a-f]{64}$/.test(token) ||
        (topic !== 'payment' && topic !== 'merchant_order') ||
        !/^\d{1,40}$/.test(resourceId)
      ) return NextResponse.json({ received: false, error: 'Invalid notification' }, { status: 400 })
      const result = await handleMarketplaceIpn({
        checkoutId,
        token,
        topic,
        resourceId
      })
      return NextResponse.json(result)
    }
    const result = await handleMarketplaceWebhook({
      headers: Object.fromEntries(request.headers),
      query: Object.fromEntries(params),
      body: JSON.parse(text)
    })
    // An active lease is not successful delivery: let the provider retry.
    return NextResponse.json(result, { status: 'outcome' in result && result.outcome === 'in_progress' ? 503 : 200 })
  } catch (error) {
    if (error instanceof RateLimitExceeded) return rateLimitResponse(error)
    const invalid =
      error instanceof InvalidWebhookSignatureError ||
      error instanceof InvalidOrderWebhookSignatureError ||
      error instanceof ValidationError ||
      (error instanceof Error && error.message === 'invalid_notification') ||
      error instanceof SyntaxError
    return NextResponse.json(
      {
        received: false,
        error: invalid ? 'Invalid notification' : 'Notification processing unavailable'
      },
      { status: invalid ? 400 : 503 }
    )
  }
}
