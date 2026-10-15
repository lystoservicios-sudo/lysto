import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
import { Constants } from '@/lib/supabase/database.types'
import { isExpiredAutomaticRequest } from '@/lib/jobs/visit-address'

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
export type MaintenancePlan = z.infer<typeof plan> & {
  activeJobId: string | null
  contextVerified: boolean
  superseded: boolean
}
const terminalJobs = new Set(['completed', 'cancelled_by_customer', 'cancelled_by_professional', 'cancelled_by_admin'])
const currentJob = z.object({
  id: uuid,
  status: z.enum(Constants.public.Enums.job_status),
  created_at: z.string().datetime({ offset: true }),
  service_requests: z.object({
    customer_id: uuid,
    equipment_id: uuid.nullable(),
    status: z.enum(Constants.public.Enums.request_status),
    contract_source: z.string().nullable()
  })
})

/** Scan all current jobs: a bounded first page cannot prove that an air has no service. */
async function currentJobsByEquipment(session: Session) {
  const jobs = new Map<string, string>()
  const batchSize = 200
  let cursorFilter: string | null = null
  let lastPagePoint: string | null = null
  for (;;) {
    let query = session.client.from('jobs')
      .select('id,status,created_at,service_requests!jobs_request_id_fkey!inner(customer_id,equipment_id,status,contract_source)')
      .eq('customer_id', session.customerId!)
      .eq('service_requests.customer_id', session.customerId!)
      .not('status', 'in', '(completed,cancelled_by_customer,cancelled_by_professional,cancelled_by_admin)')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(batchSize)
    if (cursorFilter) query = query.or(cursorFilter)
    const result = await query
    if (result.error) throw new ApiError('service_unavailable')
    const parsed = z.array(currentJob).safeParse(result.data)
    if (!parsed.success) throw new ApiError('service_unavailable')
    for (const job of parsed.data) {
      const request = job.service_requests
      if (request.customer_id !== session.customerId || terminalJobs.has(job.status) ||
        request.status === 'cancelled' || isExpiredAutomaticRequest({
          status: request.status, contractSource: request.contract_source
        })) continue
      if (request.equipment_id && !jobs.has(request.equipment_id)) jobs.set(request.equipment_id, job.id)
    }
    // Continue until an empty page, including when the server imposes a lower
    // response cap than our requested batch size.
    if (!parsed.data.length) return jobs
    const last = parsed.data.at(-1)!
    const pagePoint = `${last.created_at}/${last.id}`
    if (lastPagePoint === pagePoint) throw new ApiError('service_unavailable')
    lastPagePoint = pagePoint
    cursorFilter = `created_at.lt.${last.created_at},and(created_at.eq.${last.created_at},id.lt.${last.id})`
  }
}
function failure(error: { code?: string } | null) {
  if (error?.code === '40001') return new ApiError('conflict')
  if (error?.code === 'P0002') return new ApiError('not_found')
  if (error?.code === '22023') return new ApiError('invalid_input')
  if (error?.code === '42501') return new ApiError('forbidden')
  return new ApiError('service_unavailable')
}
export async function listMaintenance(session: Session): Promise<MaintenancePlan[]> {
  if (session.role !== 'customer' || !session.customerId) throw new ApiError('forbidden')
  const r = await session.client.rpc('list_customer_maintenance' as never)
  if (r.error) throw failure(r.error)
  const plans = z.array(plan).parse(r.data)
  if (!plans.length) return []
  let jobs = new Map<string, string>()
  let verified = true
  try { jobs = await currentJobsByEquipment(session) } catch { verified = false }
  return plans.map((item) => {
    // The RPC returns the complete equipment history, newest first. Do not carry an
    // old recommendation forward after another service produced a newer record.
    const latest = item.history[0]
    const source = item.history.find((record) => record.jobId === item.sourceJobId)
    const superseded = Boolean(item.sourceJobId && latest?.jobId && latest.jobId !== item.sourceJobId &&
      source && Date.parse(latest.performedAt) > Date.parse(source.performedAt))
    const missingSource = Boolean(item.sourceJobId && latest?.jobId && latest.jobId !== item.sourceJobId && !source)
    return { ...item, activeJobId: jobs.get(item.equipmentId) ?? null,
      contextVerified: verified && !missingSource, superseded }
  })
}
export async function manageMaintenance(session: Session, raw: unknown) {
  const i = maintenanceAction.parse(raw)
  if (i.action === 'defer') {
    const current = (await listMaintenance(session)).find((item) => item.id === i.planId)
    if (!current) throw new ApiError('not_found')
    if (!current.contextVerified) throw new ApiError('service_unavailable')
    if (current.version !== i.expectedVersion || current.superseded || current.activeJobId ||
      !['planned', 'deferred', 'requested'].includes(current.status) || current.recommendation === 'none' ||
      current.recommendation === 'pending_part_replacement' || current.recommendation === 'second_visit_recommended') {
      throw new ApiError('conflict')
    }
  }
  const r = await session.client.rpc(
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
