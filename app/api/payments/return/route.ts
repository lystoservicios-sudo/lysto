import { z } from 'zod'
import { ApiError, privateJson } from '@/lib/http/api-error'
import { marketplaceConfig, paymentError, sameOrigin } from '@/lib/payments/marketplace-config'
import { checkPaymentReturnToken } from '@/lib/payments/payment-return-token'
import { readPaymentReturnReceipt } from '@/lib/payments/payment-return-receipt'
import { paymentDatabase, type CheckoutRow } from '@/lib/payments/marketplace-db'
import { reconcileCheckout } from '@/lib/payments/marketplace'
import { enforceRateLimit, RateLimitExceeded, rateLimitResponse, requestSubject } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'
async function handle(request: Request, reconcile: boolean) {
  try {
    const checkoutId = z.string().uuid().parse(new URL(request.url).searchParams.get('checkoutId'))
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
    const { encryptionKey } = marketplaceConfig()
    if (!checkPaymentReturnToken(checkoutId, token, encryptionKey)) throw new ApiError('forbidden')
    if (reconcile) sameOrigin(request)
    await enforceRateLimit(reconcile ? 'payment_reconcile' : 'receipt',
      reconcile ? `return:${checkoutId}` : `return:${requestSubject(request)}`)
    let receipt = await readPaymentReturnReceipt(checkoutId, token, encryptionKey)
    if (!receipt) throw new ApiError('not_found')
    if (reconcile && (!['approved', 'refunded', 'partially_refunded', 'charged_back', 'review'].includes(receipt.status)
        || (receipt.status === 'approved' && !receipt.providerReferences.length))) {
      const row = await paymentDatabase().query<CheckoutRow>(
        'select * from public.marketplace_checkouts where id=$1::uuid', [checkoutId])
      if (!row.rows[0]) throw new ApiError('not_found')
      // Can only inspect the provider and apply canonical observations. This
      // capability cannot create a charge, refund, accept work or sign in.
      await reconcileCheckout(row.rows[0])
      receipt = await readPaymentReturnReceipt(checkoutId, token, encryptionKey)
    }
    return privateJson(receipt, { headers: { 'Referrer-Policy': 'no-referrer' } })
  } catch (error) {
    return error instanceof RateLimitExceeded ? rateLimitResponse(error) : paymentError(error)
  }
}
export const GET = (request: Request) => handle(request, false)
export const POST = (request: Request) => handle(request, true)
