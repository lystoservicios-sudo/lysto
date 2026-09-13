import 'server-only'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { requireAdminPermission } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
import { paymentDatabase, type CheckoutRow } from './marketplace-db'
import { closeCheckoutAtProvider } from './marketplace'

const uuid = z.string().uuid()
const reason = z.string().trim().min(10).max(2000)
const caseSchema = z.object({
  id: uuid,
  jobId: uuid,
  kind: z.string(),
  status: z.string(),
  reason: z.string(),
  version: z.number().int().positive(),
  evidence: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
  replacementJobId: uuid.nullable(),
  checkoutCount: z.number().int().nonnegative(),
  openRefundCount: z.number().int().nonnegative()
})
const refundSchema = z.object({
  id: uuid,
  paymentId: uuid,
  jobId: uuid.nullable(),
  amount: z.coerce.number(),
  paymentAmount: z.coerce.number(),
  currency: z.string(),
  reason: z.string(),
  status: z.string(),
  attemptCount: z.number().int(),
  lastError: z.string().nullable(),
  failureReason: z.string().nullable(),
  providerReference: z.string().nullable(),
  requestedAt: z.string(),
  updatedAt: z.string()
})
const paymentSchema = z.object({
  id: uuid,
  jobId: uuid.nullable(),
  amount: z.coerce.number(),
  currency: z.string(),
  status: z.string(),
  reservedAmount: z.coerce.number(),
  availableAmount: z.coerce.number()
})
const queueSchema = z.object({
  cases: z.array(caseSchema).max(100),
  refunds: z.array(refundSchema).max(100),
  refundablePayments: z.array(paymentSchema).max(100)
})
export const refundRequestSchema = z
  .object({
    action: z.literal('requestRefund'),
    paymentId: uuid,
    amount: z.number().positive(),
    reason,
    idempotencyKey: z.string().uuid()
  })
  .strict()
export const financeActionSchema = z.discriminatedUnion('action', [
  refundRequestSchema,
  z.object({ action: z.literal('closeCheckout'), checkoutId: uuid }).strict(),
  z
    .object({
      action: z.literal('clearCase'),
      caseId: uuid,
      expectedVersion: z.number().int().positive(),
      summary: reason
    })
    .strict()
])
export const jobExceptionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('cancel'),
      jobId: uuid,
      reason,
      expectedVersion: z.number().int().nonnegative()
    })
    .strict(),
  z
    .object({
      action: z.literal('replaceProfessional'),
      jobId: uuid,
      reason,
      expectedVersion: z.number().int().nonnegative()
    })
    .strict(),
  z
    .object({
      action: z.literal('resolveCase'),
      caseId: uuid,
      reason,
      expectedVersion: z.number().int().positive()
    })
    .strict()
])

function fail(code?: string): never {
  if (code === '42501') throw new ApiError('forbidden')
  if (code === 'P0002') throw new ApiError('not_found')
  if (code === '40001' || code === '23505') throw new ApiError('conflict')
  if (code?.startsWith('22') || code === '23514') throw new ApiError('invalid_input')
  throw new ApiError('service_unavailable')
}
async function rpc(session: Session, name: string, args: Record<string, unknown>) {
  const result = await (
    session.client.rpc as unknown as (
      n: string,
      a: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { code?: string } | null }>
  )(name, args)
  if (result.error) fail(result.error.code)
  return result.data
}
export async function listFinancialExceptions(session: Session) {
  if (
    session.role !== 'admin' ||
    (!session.permissions.includes('operations') &&
      !session.permissions.includes('finance') &&
      !session.permissions.includes('owner'))
  )
    throw new ApiError('forbidden')
  return queueSchema.parse(
    await rpc(session, 'list_financial_exceptions', { p_limit: 100, p_before: null })
  )
}
export async function mutateFinance(session: Session, input: unknown) {
  await requireAdminPermission('finance', session)
  const value = financeActionSchema.parse(input)
  if (value.action === 'requestRefund')
    return rpc(session, 'request_payment_refund', {
      p_payment_id: value.paymentId,
      p_amount: value.amount,
      p_reason: value.reason,
      p_idempotency_key: value.idempotencyKey
    })
  if (value.action === 'clearCase')
    return rpc(session, 'clear_financial_exception', {
      p_case_id: value.caseId,
      p_expected_version: value.expectedVersion,
      p_evidence: { summary: value.summary }
    })
  const row = await paymentDatabase().query<CheckoutRow>(
    'select * from public.marketplace_checkouts where id=$1',
    [value.checkoutId]
  )
  if (!row.rows[0]) throw new ApiError('not_found')
  const evidence = await closeCheckoutAtProvider(row.rows[0])
  return rpc(session, 'mark_marketplace_checkout_closed', {
    p_checkout_id: value.checkoutId,
    p_evidence: evidence
  })
}
export async function mutateJobException(session: Session, input: unknown) {
  await requireAdminPermission('operations', session)
  const value = jobExceptionSchema.parse(input)
  if (value.action === 'cancel')
    return rpc(session, 'request_job_cancellation', {
      p_job_id: value.jobId,
      p_reason: value.reason,
      p_expected_version: value.expectedVersion
    })
  if (value.action === 'replaceProfessional')
    return rpc(session, 'request_professional_replacement', {
      p_job_id: value.jobId,
      p_reason: value.reason,
      p_expected_version: value.expectedVersion
    })
  return rpc(session, 'resolve_financial_exception', {
    p_case_id: value.caseId,
    p_expected_version: value.expectedVersion,
    p_reason: value.reason
  })
}
