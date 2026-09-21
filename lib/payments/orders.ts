import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { cents, checkoutAmounts, decimal } from './checkout-contract'

export class InvalidOrderWebhookSignatureError extends Error {}

export function orderIdempotencyKey(checkoutId: string, operation: string) {
  const hex = createHash('sha256').update(`${checkoutId}:${operation}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export function verifyOrderWebhookSignature(input: {
  headers: Readonly<Record<string, unknown>>
  query?: Readonly<Record<string, unknown>>
  body?: unknown
}, secret: string) {
  const single = (value: unknown) => typeof value === 'string' ? value : undefined
  const query = input.query ?? {}
  const orderId = single(query['data.id'])
  const requestId = single(input.headers['x-request-id'])
  const signature = single(input.headers['x-signature'])
  const body = input.body && typeof input.body === 'object' ? input.body as Record<string, unknown> : {}
  const data = body.data && typeof body.data === 'object' ? body.data as Record<string, unknown> : {}
  const parts = Object.fromEntries((signature ?? '').split(',').map(part => part.trim().split('=')))
  const ts = parts.ts, hash = parts.v1
  if (!secret || !orderId || !/^ORD[A-Z0-9]{5,80}$/.test(orderId) ||
      !requestId || requestId.length > 200 || !/^\d{10,16}$/.test(ts ?? '') ||
      !/^[a-f0-9]{64}$/i.test(hash ?? '') || query.type !== 'order' ||
      body.type !== 'order' || data.id !== orderId)
    throw new InvalidOrderWebhookSignatureError('invalid_order_webhook_signature')
  const expected = createHmac('sha256', secret)
    .update(`id:${orderId};request-id:${requestId};ts:${ts};`).digest()
  if (!timingSafeEqual(Buffer.from(hash, 'hex'), expected))
    throw new InvalidOrderWebhookSignatureError('invalid_order_webhook_signature')
  return orderId
}

type OrderCheckout = {
  id: string
  job_id: string
  extra_id: string | null
  seller_account_id: string
  amount: string
  marketplace_fee: string
  live_mode: boolean
  created_at: Date
  expires_at: Date
}

export function buildOrderPayload(checkout: OrderCheckout, origin: string) {
  const amounts = checkoutAmounts(checkout.amount, checkout.marketplace_fee)
  const returnUrl = `${origin}/app/trabajos/${encodeURIComponent(checkout.job_id)}`
  return {
    type: 'online', processing_mode: 'manual',
    total_amount: amounts.total, marketplace_fee: amounts.fee,
    external_reference: checkout.id, expiration_time: 'PT1800S',
    description: checkout.extra_id ? 'Adicional aceptado Lysto' : 'Servicio técnico Lysto',
    items: [{ title: checkout.extra_id ? 'Adicional aceptado Lysto' : 'Servicio técnico Lysto',
      quantity: 1, unit_price: amounts.total, unit_measure: 'unit', total_amount: amounts.total }],
    config: { online: { success_url: `${returnUrl}?pago=retorno`,
      pending_url: `${returnUrl}?pago=pendiente`, failure_url: `${returnUrl}?pago=reintentar`,
      auto_return: 'approved' } }
  }
}

export function inspectCreatedOrder(checkout: OrderCheckout, raw: unknown) {
  if (!raw || typeof raw !== 'object') throw new Error('invalid_provider_response')
  const order = raw as Record<string, unknown>
  const id = String(order.id ?? '')
  if (!/^ORD[A-Z0-9]{5,80}$/.test(id)) throw new Error('invalid_provider_response')
  if (id.startsWith('ORDTST') === checkout.live_mode) throw new Error('payment_mode_mismatch')
  if (order.type !== 'online' || order.processing_mode !== 'manual' ||
      order.external_reference !== checkout.id || order.currency !== 'ARS' ||
      String(order.user_id ?? '') !== checkout.seller_account_id ||
      typeof order.total_amount !== 'string' || typeof order.marketplace_fee !== 'string' ||
      cents(order.total_amount) !== cents(checkout.amount) ||
      cents(order.marketplace_fee) !== cents(checkout.marketplace_fee))
    throw new Error('invalid_provider_response')
  if (typeof order.checkout_url !== 'string') throw new Error('invalid_provider_response')
  let url: URL
  try { url = new URL(order.checkout_url) } catch { throw new Error('invalid_provider_response') }
  if (url.protocol !== 'https:' || url.username || url.password ||
      !['mercadopago.com.ar', 'mercadopago.com'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ||
      url.searchParams.get('order_id') !== id)
    throw new Error('invalid_provider_response')
  return { id, checkoutUrl: order.checkout_url }
}

export function inspectCanonicalOrder(checkout: OrderCheckout, raw: unknown) {
  if (!raw || typeof raw !== 'object') throw new Error('invalid_provider_response')
  const order = raw as Record<string, unknown>
  const issues: string[] = []
  const matches = (actual: unknown, expected: string) => {
    try { return typeof actual === 'string' && cents(actual) === cents(expected) }
    catch { return false }
  }
  if (order.external_reference !== checkout.id) issues.push('reference_mismatch')
  if (String(order.user_id ?? '') !== checkout.seller_account_id) issues.push('seller_mismatch')
  if (!matches(order.total_amount, checkout.amount)) issues.push('amount_mismatch')
  if (!matches(order.marketplace_fee, checkout.marketplace_fee)) issues.push('fee_mismatch')
  if (order.currency !== 'ARS') issues.push('currency_mismatch')
  if (order.type !== 'online' || order.processing_mode !== 'manual') issues.push('protocol_mismatch')
  if (typeof order.id !== 'string' || !/^ORD[A-Z0-9]{5,80}$/.test(order.id)) issues.push('order_id_invalid')
  if (typeof order.id === 'string' && order.id.startsWith('ORDTST') === checkout.live_mode) issues.push('mode_mismatch')
  const updatedAt = typeof order.last_updated_date === 'string' && Number.isFinite(Date.parse(order.last_updated_date))
    ? new Date(order.last_updated_date).toISOString() : null
  if (!updatedAt) issues.push('version_missing')
  const transactions = order.transactions && typeof order.transactions === 'object'
    ? order.transactions as Record<string, unknown> : {}
  const payments = Array.isArray(transactions.payments) ? transactions.payments : []
  const refunds = Array.isArray(transactions.refunds) ? transactions.refunds : []
  const chargebacks = Array.isArray(transactions.chargebacks) ? transactions.chargebacks : []
  if (chargebacks.length) issues.push('chargeback_requires_review')
  if (payments.length > 1) issues.push('multiple_payments')
  const payment = payments[0] && typeof payments[0] === 'object'
    ? payments[0] as Record<string, unknown> : null
  const paymentId = payment && typeof payment.id === 'string' && /^PAY[A-Z0-9]{5,80}$/.test(payment.id) ? payment.id : null
  let refunded = 0n
  for (const item of refunds) {
    try {
      if (!item || typeof item !== 'object' || typeof item.amount !== 'string' ||
          item.status !== 'processed' || item.transaction_id !== paymentId)
        throw new Error('invalid_refund')
      refunded += cents(item.amount)
    } catch { issues.push('refund_unverified') }
  }
  if (refunded > cents(checkout.amount)) issues.push('refund_exceeds_payment')
  const state = `${String(order.status)}:${String(order.status_detail)}`
  let status: 'ready' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded' | 'partially_refunded' | 'review' = 'review'
  if (state === 'created:created' && matches(order.total_paid_amount, '0')) status = 'ready'
  else if (order.status === 'processing' && matches(order.total_paid_amount, '0')) status = 'pending'
  else if (order.status === 'failed' && matches(order.total_paid_amount, '0')) status = 'rejected'
  else if ((state === 'canceled:canceled' || state === 'canceled:canceled_transaction') &&
           matches(order.total_paid_amount, '0')) status = 'cancelled'
  else if ((state === 'processed:accredited' || state === 'processed:partially_refunded' ||
            state === 'processed:refunded' || state === 'refunded:refunded') &&
           paymentId &&
           ((payment?.status === 'processed' && payment.status_detail === 'accredited') ||
            ((state === 'processed:refunded' || state === 'refunded:refunded') &&
             payment?.status === 'refunded' && payment.status_detail === 'refunded')) &&
           matches(payment.amount, checkout.amount) && matches(payment.paid_amount, checkout.amount) &&
           matches(order.total_paid_amount, checkout.amount)) {
    const total = cents(checkout.amount)
    if (state === 'processed:accredited' && refunded === 0n) status = 'approved'
    else if (state === 'processed:partially_refunded' && refunded > 0n && refunded < total) status = 'partially_refunded'
    else if ((state === 'processed:refunded' || state === 'refunded:refunded') && refunded === total) status = 'refunded'
  }
  if (status === 'review') issues.push('unknown_or_unverified_order_state')
  if (issues.length) status = 'review'
  return { orderId: typeof order.id === 'string' ? order.id : null,
    paymentId, status, issues, updatedAt, refundedAmount: decimal(refunded) }
}
