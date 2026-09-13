import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'

const uuid = z.string().uuid(),
  maintenance = z.enum([
    'none',
    'filters_30_days',
    'filters_60_days',
    'filters_90_days',
    'deep_cleaning_6_months',
    'deep_cleaning_annual',
    'gas_review_30_days',
    'outdoor_unit_review',
    'electrical_review',
    'pending_part_replacement',
    'second_visit_recommended'
  ])
export const maintenanceAction = z
  .object({
    planId: uuid,
    action: z.enum(['defer', 'request_service']),
    expectedVersion: z.number().int().positive(),
    dueDate: z.string().date().optional(),
    addressId: uuid.optional()
  })
  .strict()
  .superRefine((v, c) => {
    if (v.action === 'defer' && !v.dueDate)
      c.addIssue({ code: 'custom', message: 'due_date_required' })
    if (v.action === 'request_service' && !v.addressId)
      c.addIssue({ code: 'custom', message: 'address_required' })
  })
const plan = z.object({
  id: uuid,
  equipmentId: uuid,
  equipmentName: z.string(),
  recommendation: maintenance,
  dueAt: z.string().nullable(),
  status: z.enum([
    'planned',
    'deferred',
    'suppressed_by_case',
    'requested',
    'completed',
    'cancelled'
  ]),
  version: z.number().int(),
  sourceJobId: uuid.nullable(),
  history: z.array(
    z.object({
      id: uuid,
      jobId: uuid.nullable(),
      performedAt: z.string(),
      diagnosis: z.string().nullable(),
      workDone: z.string().nullable(),
      professionalId: uuid.nullable()
    })
  )
})
function failure(error: { code?: string } | null) {
  if (error?.code === '40001') return new ApiError('conflict')
  if (error?.code === 'P0002') return new ApiError('not_found')
  if (error?.code === '22023') return new ApiError('invalid_input')
  if (error?.code === '42501') return new ApiError('forbidden')
  return new ApiError('service_unavailable')
}
export async function listMaintenance(session: Session) {
  const r = await session.client.rpc('list_customer_maintenance' as never)
  if (r.error) throw failure(r.error)
  return z.array(plan).parse(r.data)
}
export async function manageMaintenance(session: Session, raw: unknown) {
  const i = maintenanceAction.parse(raw),
    r = await session.client.rpc(
      'manage_maintenance_plan' as never,
      {
        p_plan_id: i.planId,
        p_action: i.action,
        p_expected_version: i.expectedVersion,
        p_due_date: i.dueDate ?? null,
        p_address_id: i.addressId ?? null
      } as never
    )
  if (r.error) throw failure(r.error)
  return z
    .object({
      id: uuid,
      status: z.string(),
      dueAt: z.string().nullable(),
      version: z.number().int(),
      requestId: uuid.nullable(),
      reservationCreated: z.literal(false),
      paymentCreated: z.literal(false)
    })
    .parse(r.data)
}
