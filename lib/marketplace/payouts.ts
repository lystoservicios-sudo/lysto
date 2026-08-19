import type { PaymentStatus } from '../domain/types.ts'
import { calculateMarketplaceSplit } from '../payments/idempotency.ts'

export type SettlementStatus = 'not_ready' | 'ready_to_settle' | 'settled' | 'blocked' | 'refunded'

export type PayoutInput = {
  paymentStatus: PaymentStatus
  jobCompleted: boolean
  hasOpenComplaint: boolean
  grossAmount: number
  platformFeeRate: number
  professionalMercadoPagoConnected: boolean
}

export type PayoutDecision = {
  status: SettlementStatus
  platformFee: number
  professionalAmount: number
  reason: string
}

export function decidePayout(input: PayoutInput): PayoutDecision {
  const split = calculateMarketplaceSplit(input.grossAmount, input.platformFeeRate)
  if (input.paymentStatus === 'refunded' || input.paymentStatus === 'partially_refunded') return { status: 'refunded', ...split, reason: 'payment_refunded' }
  if (input.paymentStatus !== 'approved' && input.paymentStatus !== 'captured') return { status: 'not_ready', ...split, reason: 'payment_not_approved' }
  if (!input.professionalMercadoPagoConnected) return { status: 'blocked', ...split, reason: 'professional_payment_account_missing' }
  if (!input.jobCompleted) return { status: 'not_ready', ...split, reason: 'job_not_completed' }
  if (input.hasOpenComplaint) return { status: 'blocked', ...split, reason: 'open_quality_case' }
  return { status: 'ready_to_settle', ...split, reason: 'ready' }
}

export function buildSettlementReference(jobId: string, professionalId: string): string {
  const cleanJob = jobId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 32)
  const cleanPro = professionalId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 32)
  if (!cleanJob || !cleanPro) throw new Error('invalid_settlement_reference')
  return `lysto:${cleanJob}:${cleanPro}`
}
