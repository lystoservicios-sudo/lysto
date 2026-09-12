import { z } from 'zod'

const claimSchema = z.object({
  request_id: z.string().uuid(),
  payment_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  currency: z.literal('ARS'),
  reason: z.string(),
  provider_payment_id: z.string().min(1),
  provider_idempotency_key: z.string().min(1).max(128),
  claim_token: z.string().uuid(),
  attempt_count: z.number().int().positive(),
  locked_until: z.string().datetime({ offset: true }),
  status: z.literal('processing')
})
const contextSchema = z.object({
  professionalId: z.string().uuid(),
  checkoutId: z.string().uuid(),
  paymentAmount: z.coerce.number().positive()
})
type Claim = z.infer<typeof claimSchema>
type Context = z.infer<typeof contextSchema>
export type RefundRpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { code?: string } | null }>
}
export type RefundExecution = {
  providerReference: string
  canonicalPayment: Record<string, unknown>
}

export async function runRefundBatch(
  client: RefundRpcClient,
  options: {
    batchSize?: number
    now?: () => Date
    execute: (claim: Claim, context: Context) => Promise<RefundExecution>
    applyCanonical: (
      checkoutId: string,
      payment: Record<string, unknown>,
      eventId: string
    ) => Promise<unknown>
  }
) {
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.rpc(name, args)
    if (result.error)
      throw Object.assign(new Error('refund_database_error'), { code: result.error.code })
    return result.data
  }
  const claims = z
    .array(claimSchema)
    .max(5)
    .parse(
      await call('claim_payment_refund_requests', {
        p_batch_size: z
          .number()
          .int()
          .min(1)
          .max(5)
          .parse(options.batchSize ?? 5),
        p_lease_seconds: 120
      })
    )
  const result = { claimed: claims.length, succeeded: 0, retrying: 0, failed: 0, lostClaims: 0 }
  for (const claim of claims) {
    if (Date.parse(claim.locked_until) <= (options.now ?? (() => new Date()))().getTime()) {
      result.lostClaims++
      continue
    }
    try {
      const context = contextSchema.parse(
        await call('get_payment_refund_execution_context', {
          p_request_id: claim.request_id,
          p_claim_token: claim.claim_token
        })
      )
      const executed = await options.execute(claim, context)
      await options.applyCanonical(
        context.checkoutId,
        executed.canonicalPayment,
        `refund-worker:${claim.request_id}:${String(executed.canonicalPayment.date_last_updated ?? executed.providerReference)}`
      )
      await call('finalize_payment_refund_request', {
        p_request_id: claim.request_id,
        p_claim_token: claim.claim_token,
        p_provider_reference: executed.providerReference
      })
      result.succeeded++
    } catch (error) {
      const definitive =
        error instanceof Error && 'definitive' in error && error.definitive === true
      try {
        await call('fail_payment_refund_request', {
          p_request_id: claim.request_id,
          p_claim_token: claim.claim_token,
          p_failure_reason: definitive ? 'provider_rejected_refund' : 'provider_result_uncertain',
          p_is_definitive: definitive,
          p_retry_seconds: Math.min(3600, 60 * 2 ** Math.min(claim.attempt_count - 1, 6))
        })
        if (definitive) result.failed++
        else result.retrying++
      } catch {
        result.lostClaims++
      }
    }
  }
  return result
}
