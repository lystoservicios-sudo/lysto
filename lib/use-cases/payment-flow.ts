import type { PaymentStatus, UrgencyLevel } from '../domain/types.ts'
import { assertTransition, paymentTransitions } from '../domain/state-machine.ts'
import { calculateMarketplaceSplit, isDuplicateWebhook, normalizePaymentStatus, type MercadoPagoWebhookEvent, type StoredPaymentEvent } from '../payments/idempotency.ts'

export type PaymentPreferenceCommand = {
  requestId: string
  customerId: string
  amount: number
  selectedOption: UrgencyLevel
  platformFeeRate?: number
}

export type PaymentPreferenceDraft = {
  provider: 'mercadopago'
  requestId: string
  customerId: string
  amount: number
  selectedOption: UrgencyLevel
  idempotencyKey: string
  split: { total: number; platformFee: number; professionalAmount: number }
  status: PaymentStatus
}

export function createPaymentPreferenceDraft(command: PaymentPreferenceCommand): PaymentPreferenceDraft {
  if (!command.requestId.trim()) throw new Error('request_id_required')
  if (!command.customerId.trim()) throw new Error('customer_id_required')
  const split = calculateMarketplaceSplit(command.amount, command.platformFeeRate ?? 0.18)
  return {
    provider: 'mercadopago',
    requestId: command.requestId,
    customerId: command.customerId,
    amount: command.amount,
    selectedOption: command.selectedOption,
    idempotencyKey: `mp:${command.requestId}:${command.selectedOption}:${command.amount}`,
    split,
    status: 'pending'
  }
}

export type PaymentWebhookApplication = {
  duplicate: boolean
  providerPaymentId: string
  fromStatus: PaymentStatus
  toStatus: PaymentStatus
  shouldCreateJob: boolean
  shouldNotifyAdmin: boolean
}

export function applyPaymentWebhook(params: {
  event: MercadoPagoWebhookEvent
  storedEvents: StoredPaymentEvent[]
  currentStatus: PaymentStatus
}): PaymentWebhookApplication {
  const providerPaymentId = params.event.data?.id ?? params.event.id
  if (!providerPaymentId) throw new Error('provider_payment_id_required')
  if (isDuplicateWebhook(params.event, params.storedEvents)) {
    return {
      duplicate: true,
      providerPaymentId,
      fromStatus: params.currentStatus,
      toStatus: params.currentStatus,
      shouldCreateJob: false,
      shouldNotifyAdmin: false
    }
  }
  const normalized = normalizePaymentStatus(params.event.status)
  if (normalized !== params.currentStatus) assertTransition(paymentTransitions, params.currentStatus, normalized, 'payment')
  return {
    duplicate: false,
    providerPaymentId,
    fromStatus: params.currentStatus,
    toStatus: normalized,
    shouldCreateJob: normalized === 'approved' || normalized === 'captured',
    shouldNotifyAdmin: normalized === 'rejected' || normalized === 'failed' || normalized === 'cancelled'
  }
}
