import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '@/lib/supabase/database.types'
import { marketplaceOAuth } from './marketplace'
import { applyCanonicalPayment } from './marketplace-ledger'
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
    execute: async (claim, context) =>
      executeMercadoPagoRefund({
        providerPaymentId: claim.provider_payment_id,
        amount: claim.amount,
        paymentAmount: context.paymentAmount,
        idempotencyKey: claim.provider_idempotency_key,
        accessToken: await marketplaceOAuth().getValidAccessToken(context.professionalId)
      }),
    applyCanonical: applyCanonicalPayment
  })
}
