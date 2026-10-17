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
class WebhookBodyError extends Error {
  constructor(readonly status: 408 | 413) { super(status === 413 ? 'Payload too large' : 'Payload timeout') }
}
async function readWebhookBody(request: Request): Promise<string> {
  if (Number(request.headers.get('content-length') ?? 0) > 65536) throw new WebhookBodyError(413)
  const reader = request.body?.getReader()
  if (!reader) return ''
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new WebhookBodyError(408)), 3000)
  })
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), timeout])
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 65536) throw new WebhookBodyError(413)
      chunks.push(chunk.value)
    }
    return Buffer.concat(chunks).toString('utf8')
  } finally {
    clearTimeout(timer)
    void reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
export async function POST(request: Request) {
  try {
    await enforceRateLimit('webhook', requestSubject(request))
    const text = await readWebhookBody(request)
    const params = new URL(request.url).searchParams
    if ([...new Set(params.keys())].some((key) => params.getAll(key).length > 1))
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
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
    if (error instanceof WebhookBodyError)
      return NextResponse.json({ received: false, error: error.message }, { status: error.status })
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
