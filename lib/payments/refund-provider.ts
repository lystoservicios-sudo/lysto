import { z } from 'zod'

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
  providerPaymentId: string
  amount: number
  paymentAmount?: number
  idempotencyKey: string
  accessToken: string
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
