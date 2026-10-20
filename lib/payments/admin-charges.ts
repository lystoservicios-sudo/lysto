import 'server-only'
import { z } from 'zod'
import { requireAdminPermission, type Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'

export const adminChargeSchema = z.object({
  jobId: z.string().uuid(),
  concept: z.string().trim().min(5).max(500),
  description: z.string().trim().min(10).max(2000),
  amount: z.number().finite().positive().max(100000000)
    .refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001),
  commissionMode: z.enum(['standard', 'none']),
  expectedCommissionRate: z.number().finite().min(0).max(0.5),
  reason: z.string().trim().min(10).max(2000),
  idempotencyKey: z.string().uuid()
}).strict()

export const adminPaymentContextSchema = z.object({
  commissionRate: z.number().finite().min(0).max(0.5),
  jobs: z.array(z.object({
    id: z.string().uuid(), version: z.number().int().nonnegative(), status: z.string(),
    customerName: z.string(), professionalName: z.string().nullable(),
    issueLabel: z.string(), canCharge: z.boolean(), matchesSearch: z.boolean().default(true)
  })).max(400)
})

async function rpc(session: Session, name: string, args: Record<string, unknown>) {
  const result = await (session.client.rpc as unknown as (
    name: string, args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { code?: string } | null }>)(name, args)
  if (result.error) {
    const code = result.error.code
    throw new ApiError(code === '42501' ? 'forbidden' : code === 'P0002' ? 'not_found'
      : ['40001', '23505'].includes(code ?? '') ? 'conflict'
      : code?.startsWith('22') || code === '23514' ? 'invalid_input' : 'service_unavailable')
  }
  return result.data
}

export async function listAdminPaymentContext(session: Session, input: unknown = {}) {
  if (session.role !== 'admin' ||
      !session.permissions.some(permission => ['finance', 'operations', 'owner'].includes(permission)))
    throw new ApiError('forbidden')
  await requireAdminPermission(session.permissions.includes('operations') ? 'operations' : 'finance', session)
  const query = z.object({ search: z.string().trim().max(120).optional(), jobIds: z.array(z.string().uuid()).max(300).optional() }).strict().parse(input)
  return adminPaymentContextSchema.parse(await rpc(session, 'get_admin_payment_context', {
    p_search: query.search || null, p_job_ids: query.jobIds ?? null
  }))
}

export async function createAdminCharge(session: Session, input: unknown) {
  await requireAdminPermission('finance', session)
  const value = adminChargeSchema.parse(input)
  return rpc(session, 'create_admin_charge', {
    p_job_id: value.jobId, p_concept: value.concept, p_description: value.description,
    p_amount: value.amount, p_commission_mode: value.commissionMode,
    p_expected_commission_rate: value.expectedCommissionRate,
    p_reason: value.reason, p_idempotency_key: value.idempotencyKey
  })
}
