import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '@/lib/supabase/database.types'
import { marketplaceOAuth } from './marketplace'
import { applyCanonicalOrder, applyCanonicalPayment } from './marketplace-ledger'
import { checkoutProtocol } from './checkout-contract'
import { paymentDatabase, type CheckoutRow } from './marketplace-db'
import { executeMercadoPagoRefund } from './refund-provider'
import { runRefundBatch } from './refund-service'

export async function dispatchRefunds(batchSize: number) {
  if (process.env.PAYMENTS_PROVIDER !== 'mercadopago_split')
    throw new Error('refund_worker_disabled')
  const client = createClient<Database>(
    z.string().url().parse(process.env.NEXT_PUBLIC_SUPABASE_URL),
    z.string().min(1).parse(process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  return runRefundBatch(client as never, {
    batchSize,
    execute: async (claim, context) => {
      const row = await paymentDatabase().query<CheckoutRow>(
        'select * from public.marketplace_checkouts where id=$1', [context.checkoutId])
      const checkout = row.rows[0]
      if (!checkout) throw new Error('checkout_review')
      const protocol = checkoutProtocol(checkout)
      if (protocol === 'orders' && !checkout.order_id) throw new Error('checkout_review')
      return executeMercadoPagoRefund({
        orderId: protocol === 'orders' ? checkout.order_id! : undefined,
        providerPaymentId: claim.provider_payment_id,
        amount: claim.amount,
        paymentAmount: context.paymentAmount,
        idempotencyKey: claim.provider_idempotency_key,
        accessToken: await marketplaceOAuth().getValidAccessToken(context.professionalId),
        persistOrderRefundBaseline: protocol === 'orders' ? async refundIds => {
          const saved = await paymentDatabase().query<{ order_refund_baseline: string[] }>(
            `update private.payment_refund_requests as current_request
              set order_refund_baseline=coalesce(order_refund_baseline,$3::text[])
              where id=$1 and claim_token=$2 and status='processing'
                and locked_until>clock_timestamp()
                and not exists (
                  select 1 from private.payment_refund_requests earlier
                  where earlier.payment_id=current_request.payment_id
                    and earlier.id<>current_request.id
                    and earlier.status in ('requested','processing')
                    and (earlier.requested_at,earlier.id)<
                      (current_request.requested_at,current_request.id))
              returning order_refund_baseline`,
            [claim.request_id, claim.claim_token, refundIds])
          if (!saved.rows[0]) throw new Error('refund_claim_stale')
          return saved.rows[0].order_refund_baseline
        } : undefined
      })
    },
    applyCanonical: async (checkoutId, canonical, eventId) => {
      const row = await paymentDatabase().query<CheckoutRow>(
        'select * from public.marketplace_checkouts where id=$1', [checkoutId])
      const checkout = row.rows[0]
      if (!checkout) throw new Error('checkout_review')
      return checkoutProtocol(checkout) === 'orders'
        ? applyCanonicalOrder(checkoutId, canonical, eventId)
        : applyCanonicalPayment(checkoutId, canonical, eventId)
    }
  })
}
