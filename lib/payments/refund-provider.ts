import { z } from 'zod'
import { cents, decimal } from './checkout-contract'

const refundSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    payment_id: z.union([z.string(), z.number()]),
    amount: z.coerce.number().positive(),
    status: z.string()
  })
  .passthrough()
const paymentSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    status: z.string(),
    date_last_updated: z.string()
  })
  .passthrough()

export class RefundProviderError extends Error {
  constructor(
    message: string,
    readonly definitive: boolean
  ) {
    super(message)
    this.name = 'RefundProviderError'
  }
}

async function providerResponse(response: Response) {
  if (!response.ok) {
    const retryable = response.status >= 500 || [408, 423, 425, 429].includes(response.status)
    throw new RefundProviderError(`provider_http_${response.status}`, !retryable)
  }
  const text = await response.text()
  if (text.length > 1_000_000) throw new RefundProviderError('invalid_provider_response', false)
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new RefundProviderError('invalid_provider_response', false)
  }
}

export async function executeMercadoPagoRefund(input: {
  orderId?: string
  providerPaymentId: string
  amount: number
  paymentAmount?: number
  idempotencyKey: string
  accessToken: string
  persistOrderRefundBaseline?: (refundIds: string[]) => Promise<string[]>
  fetcher?: typeof fetch
}) {
  const fetcher = input.fetcher ?? fetch
  const request = async (path: string, init?: RequestInit) => {
    try {
      return await providerResponse(
        await fetcher(`https://api.mercadopago.com${path}`, {
          cache: 'no-store',
          redirect: 'error',
          signal: AbortSignal.timeout(20_000),
          ...init,
          headers: {
            Authorization: `Bearer ${input.accessToken}`,
            'Content-Type': 'application/json',
            ...(init?.headers ?? {})
          }
        })
      )
    } catch (error) {
      if (error instanceof RefundProviderError) throw error
      throw new RefundProviderError('provider_request_uncertain', false)
    }
  }
  if (input.orderId) {
    if (!input.persistOrderRefundBaseline)
      throw new RefundProviderError('refund_baseline_required', false)
    const path = `/v1/orders/${encodeURIComponent(input.orderId)}`
    const before = await request(path) as Record<string, unknown>
    const transactions = before.transactions && typeof before.transactions === 'object'
      ? before.transactions as Record<string, unknown> : {}
    const payments = Array.isArray(transactions.payments) ? transactions.payments : []
    const payment = payments.length === 1 ? payments[0] as Record<string, unknown> : null
    if (before.id !== input.orderId || payment?.id !== input.providerPaymentId ||
        typeof payment.amount !== 'string' || cents(payment.amount) !== cents(input.paymentAmount ?? 0))
      throw new RefundProviderError('refund_order_identity_unverified', false)
    const oldRefunds = Array.isArray(transactions.refunds) ? transactions.refunds : []
    const knownIds = oldRefunds.map((item: { id?: unknown }) => item?.id)
    if (knownIds.some(id => typeof id !== 'string' || !id))
      throw new RefundProviderError('refund_result_unverified', false)
    const baseline = await input.persistOrderRefundBaseline(knownIds as string[])
    const previousIds = new Set(baseline)
    const full = input.paymentAmount !== undefined && cents(input.amount) === cents(input.paymentAmount)
    const recover = (canonicalOrder: Record<string, unknown>) => {
      if (canonicalOrder.id !== input.orderId)
        throw new RefundProviderError('refund_result_unverified', false)
      const afterTransactions = canonicalOrder.transactions && typeof canonicalOrder.transactions === 'object'
        ? canonicalOrder.transactions as Record<string, unknown> : {}
      const refunds = Array.isArray(afterTransactions.refunds) ? afterTransactions.refunds : []
      const newRefunds = refunds.filter((item: { id?: unknown }) => !previousIds.has(String(item?.id ?? '')))
      if (!newRefunds.length) return null
      const verified = newRefunds.length === 1 ? newRefunds[0] as Record<string, unknown> : null
      if (!verified || typeof verified.id !== 'string' || !verified.id ||
          verified.transaction_id !== input.providerPaymentId || verified.status !== 'processed' ||
          typeof verified.amount !== 'string' || cents(verified.amount) !== cents(input.amount))
        throw new RefundProviderError('refund_result_unverified', false)
      return { providerReference: verified.id, canonicalPayment: canonicalOrder }
    }
    const alreadyApplied = recover(before)
    if (alreadyApplied) return alreadyApplied
    let postError: unknown
    try {
      await request(`${path}/refund`, { method: 'POST',
        headers: { 'X-Idempotency-Key': input.idempotencyKey },
        body: JSON.stringify(full ? {} : { transactions: [{ id: input.providerPaymentId,
          amount: decimal(cents(input.amount)) }] }) })
    } catch (error) { postError = error }
    const canonicalOrder = await request(path) as Record<string, unknown>
    const applied = recover(canonicalOrder)
    if (applied) return applied
    if (postError instanceof RefundProviderError && postError.message !== 'provider_http_409')
      throw postError
    throw new RefundProviderError('refund_result_unverified', false)
  }
  const path = `/v1/payments/${encodeURIComponent(input.providerPaymentId)}/refunds`
  const isFull = input.paymentAmount !== undefined && input.amount === input.paymentAmount
  const created = refundSchema.parse(
    await request(path, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify(isFull ? {} : { amount: input.amount })
    })
  )
  const refundId = String(created.id)
  const verified = refundSchema.parse(await request(`${path}/${encodeURIComponent(refundId)}`))
  if (
    String(verified.payment_id) !== input.providerPaymentId ||
    verified.amount !== input.amount ||
    verified.status !== 'approved'
  )
    throw new RefundProviderError('refund_result_unverified', false)
  const canonicalPayment = paymentSchema.parse(
    await request(`/v1/payments/${encodeURIComponent(input.providerPaymentId)}`)
  )
  if (String(canonicalPayment.id) !== input.providerPaymentId)
    throw new RefundProviderError('payment_result_unverified', false)
  return { providerReference: refundId, canonicalPayment }
}
