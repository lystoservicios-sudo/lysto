import { z } from 'zod'

export function cents(value: string | number): bigint {
  const text = String(value)
  if (!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(text)) throw new Error('invalid_payment_amount')
  const [whole, fraction = ''] = text.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}
export function decimal(value: bigint): string {
  if (value < 0n) throw new Error('invalid_payment_amount')
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`
}
export function checkoutAmounts(total: string | number, fee: string | number) {
  const amount = cents(total), commission = cents(fee)
  if (amount <= 0n || commission > amount) throw new Error('invalid_payment_split')
  return { total: decimal(amount), fee: decimal(commission), professional: decimal(amount - commission) }
}

type PreferenceBody = { date_of_expiration?: string; external_reference: string; [key: string]: unknown }
export function buildPreferencePayload(body: PreferenceBody, origin: string, createdAt: Date) {
  const { date_of_expiration, ...rest } = body
  if (!date_of_expiration || !Number.isFinite(Date.parse(date_of_expiration))) throw new Error('payment_expiry_required')
  return { ...rest, expires: true, expiration_date_from: createdAt.toISOString(), expiration_date_to: date_of_expiration,
    notification_url: `${origin}/api/mercadopago/webhook` }
}

const identifier = z.union([z.string().min(1), z.number().int().nonnegative()]).transform(String)
const amount = z.union([z.number().finite().nonnegative(), z.string()]).transform(v => decimal(cents(v)))
const canonicalPaymentSchema = z.object({
  id: identifier, collector_id: identifier, external_reference: z.string().nullable(), currency_id: z.string(),
  transaction_amount: amount, transaction_amount_refunded: amount, live_mode: z.boolean(), status: z.string(),
  date_last_updated: z.string().refine(v => Number.isFinite(Date.parse(v))),
  fee_details: z.array(z.object({ type: z.string(), amount })).default([]),
  transaction_details: z.object({ net_received_amount: amount.optional() }).optional(),
})
export type CheckoutIdentity = { id: string; seller_account_id: string; amount: string; marketplace_fee: string; live_mode: boolean }
export function inspectPayment(checkout: CheckoutIdentity, raw: unknown) {
  const payment = canonicalPaymentSchema.parse(raw)
  const issues: string[] = []
  if (payment.external_reference !== checkout.id) issues.push('reference_mismatch')
  if (payment.collector_id !== checkout.seller_account_id) issues.push('seller_mismatch')
  if (cents(payment.transaction_amount) !== cents(checkout.amount)) issues.push('amount_mismatch')
  if (payment.currency_id !== 'ARS') issues.push('currency_mismatch')
  if (payment.live_mode !== checkout.live_mode) issues.push('mode_mismatch')
  const fee = payment.fee_details.filter(f => f.type === 'application_fee').reduce((sum, f) => sum + cents(f.amount), 0n)
  const refund = cents(payment.transaction_amount_refunded)
  if (payment.status === 'approved' && refund === 0n && fee !== cents(checkout.marketplace_fee)) issues.push('fee_mismatch')
  if (refund > cents(payment.transaction_amount)) issues.push('refund_mismatch')
  const status = refund > 0n && payment.status !== 'charged_back' ? refund < cents(payment.transaction_amount) ? 'partially_refunded' : 'refunded' : payment.status
  return { paymentId: payment.id, status, issues, updatedAt: new Date(payment.date_last_updated).toISOString(),
    refundedAmount: payment.transaction_amount_refunded, observedFee: decimal(fee),
    providerFee: decimal(payment.fee_details.filter(f => f.type !== 'application_fee').reduce((sum, f) => sum + cents(f.amount), 0n)),
    netReceived: payment.transaction_details?.net_received_amount ?? null }
}

export const paymentStatusLabels: Record<string, string> = {
  creating: 'Preparando pago', ready: 'Listo para pagar', pending: 'Pendiente de confirmación', in_process: 'En proceso',
  approved: 'Pago aprobado', rejected: 'Pago rechazado', cancelled: 'Pago cancelado', refunded: 'Reembolsado',
  partially_refunded: 'Reembolso parcial', charged_back: 'Contracargo', review: 'Requiere revisión', expired: 'Enlace vencido',
}
