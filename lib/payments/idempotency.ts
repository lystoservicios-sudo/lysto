import type { PaymentStatus } from '../domain/types.ts'

export type MercadoPagoWebhookEvent = {
  id: string
  type: string
  action?: string
  data?: { id?: string }
  status?: PaymentStatus | 'charged_back' | 'review' | 'in_process'
  raw?: unknown
}

export type StoredPaymentEvent = {
  providerEventId: string
  paymentId?: string
  status?: PaymentStatus
}

export function isDuplicateWebhook(event: MercadoPagoWebhookEvent, storedEvents: StoredPaymentEvent[]): boolean {
  return storedEvents.some((stored) => stored.providerEventId === event.id)
}

export function normalizePaymentStatus(providerStatus: string | undefined | null): PaymentStatus {
  switch (providerStatus) {
    case 'approved': return 'approved'
    case 'authorized': return 'authorized'
    case 'rejected': return 'rejected'
    case 'cancelled': return 'cancelled'
    case 'refunded': return 'refunded'
    case 'partially_refunded': return 'partially_refunded'
    case 'captured': return 'captured'
    case 'failed': return 'failed'
    case 'review': return 'failed'
    case 'charged_back': return 'failed'
    case 'in_process': return 'pending'
    case 'pending': return 'pending'
    default: return 'pending'
  }
}

export function calculateMarketplaceSplit(total: number, platformFeeRate: number): { total: number; platformFee: number; professionalAmount: number } {
  if (total <= 0) throw new Error('Total must be positive')
  if (platformFeeRate < 0 || platformFeeRate >= 1) throw new Error('Invalid platform fee rate')
  const platformFee = Math.round(total * platformFeeRate)
  return { total, platformFee, professionalAmount: total - platformFee }
}
