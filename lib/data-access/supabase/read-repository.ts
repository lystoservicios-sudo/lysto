import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '@/lib/supabase/database.types'
import { Constants } from '@/lib/supabase/database.types'
import { encodeCursor, parsePageInput } from '../pagination'
import type {
  ReadDtoMap,
  ReadMetrics,
  ReadOptions,
  ReadRepository,
  ReadResource,
  ReadRole
} from '../read-contracts'

export class ReadModelError extends Error {
  constructor(readonly code: 'forbidden' | 'invalid_input' | 'unavailable') {
    super(
      code === 'unavailable'
        ? 'No pudimos cargar los datos. Intentá nuevamente.'
        : code === 'forbidden'
          ? 'No tenés acceso a estos datos.'
          : 'La consulta no es válida.'
    )
  }
}
const uuid = z.string().uuid(),
  date = z.string().datetime({ offset: true }),
  nullableString = z.string().nullable(),
  number = z.number().finite()
const base = { id: uuid, created_at: date }
const schemas = {
  requests: z.object({
    ...base,
    status: z.enum(Constants.public.Enums.request_status),
    issue_type_id: uuid,
    address_id: uuid.nullable(),
    equipment_id: uuid.nullable(),
    preferred_date: nullableString,
    preferred_time_window: nullableString,
    urgency_level: z.enum(Constants.public.Enums.urgency_level).nullable()
  }),
  jobs: z.object({
    ...base,
    request_id: uuid,
    status: z.enum(Constants.public.Enums.job_status),
    professional_id: uuid.nullable(),
    scheduled_date: nullableString,
    scheduled_time_window: nullableString,
    completed_at: date.nullable(),
    final_amount: number.nullable(),
    warranty_until: nullableString
  }),
  payments: z.object({
    ...base,
    request_id: uuid.nullable(),
    job_id: uuid.nullable(),
    status: z.enum(Constants.public.Enums.payment_status),
    currency: z.string(),
    amount: number.optional(),
    professional_amount: number.optional(),
    marketplace_fee: number.optional(),
    provider: z.string().optional(),
    provider_payment_id: nullableString.optional()
  }),
  equipment: z.object({
    ...base,
    nickname: z.string(),
    equipment_type: nullableString,
    brand: nullableString,
    model: nullableString
  }),
  professionals: z.object({
    ...base,
    status: z.enum(Constants.public.Enums.professional_status),
    rating_avg: number.nullable(),
    jobs_completed: number.int(),
    years_experience: number.int(),
    internal_score: number.optional()
  }),
  claims: z.object({
    ...base,
    job_id: uuid,
    status: z.string(),
    description: z.string(),
    resolution: nullableString
  })
}
const definitions = {
  requests: {
    table: 'service_requests',
    columns:
      'id,created_at,status,issue_type_id,address_id,equipment_id,preferred_date,preferred_time_window,urgency_level'
  },
  jobs: {
    table: 'jobs',
    columns:
      'id,created_at,request_id,status,professional_id,scheduled_date,scheduled_time_window,completed_at,final_amount,warranty_until'
  },
  payments: { table: 'payments', columns: 'id,created_at,request_id,job_id,status,currency' },
  equipment: {
    table: 'customer_equipment',
    columns: 'id,created_at,nickname,equipment_type,brand,model'
  },
  professionals: {
    table: 'professional_profiles',
    columns: 'id,created_at,status,rating_avg,jobs_completed,years_experience'
  },
  claims: {
    table: 'warranty_claims',
    columns: 'id,created_at,job_id,status,description,resolution'
  }
} as const
const resourceSchema = z.enum([
  'requests',
  'jobs',
  'payments',
  'equipment',
  'professionals',
  'claims'
])
const contextSchema = z.object({
  profile_id: uuid,
  role: z.enum(['customer', 'professional', 'admin']),
  customer_id: uuid.nullable(),
  professional_id: uuid.nullable(),
  professional_status: nullableString,
  permissions: z.array(z.enum(['operations', 'finance', 'quality', 'owner'])),
  session_active: z.literal(true),
  aal: z.enum(['aal1', 'aal2'])
})
const optionsSchema = z
  .object({
    pageSize: z.number().optional(),
    cursor: z.string().optional(),
    status: z
      .string()
      .regex(/^[a-z_]{1,50}$/)
      .optional()
  })
  .strict()
type Context = z.infer<typeof contextSchema>
const adminScopes: Record<ReadResource, Context['permissions']> = {
  requests: ['operations', 'quality', 'finance'],
  jobs: ['operations', 'quality', 'finance'],
  payments: ['finance'],
  equipment: ['operations', 'quality'],
  professionals: ['operations'],
  claims: ['quality']
}
function allowed(context: Context, resource: ReadResource) {
  if (context.role === 'customer') return resource !== 'professionals'
  if (context.role === 'professional') return true
  return (
    context.permissions.includes('owner') ||
    adminScopes[resource].some((p) => context.permissions.includes(p))
  )
}
async function resolveReader(client: SupabaseClient<Database>, role: ReadRole): Promise<Context> {
  const identity = await client.auth.getUser()
  if (identity.error || !identity.data.user)
    throw new ReadModelError(
      identity.error && (identity.error.status ?? 0) >= 500 ? 'unavailable' : 'forbidden'
    )
  const result = await client.rpc('get_session_context')
  if (result.error)
    throw new ReadModelError(result.error.code === '42501' ? 'forbidden' : 'unavailable')
  const parsed = contextSchema.safeParse(result.data)
  if (
    !parsed.success ||
    parsed.data.role !== role ||
    identity.data.user.app_metadata.app_role !== role
  )
    throw new ReadModelError('forbidden')
  if (role === 'customer' && !parsed.data.customer_id) throw new ReadModelError('forbidden')
  if (
    role === 'professional' &&
    (!parsed.data.professional_id || parsed.data.professional_status !== 'approved')
  )
    throw new ReadModelError('forbidden')
  if (role === 'admin' && (parsed.data.permissions.length === 0 || parsed.data.aal !== 'aal2'))
    throw new ReadModelError('forbidden')
  return parsed.data
}
function selection(resource: ReadResource, role: ReadRole) {
  let columns: string = definitions[resource].columns
  if (resource === 'payments')
    columns +=
      role === 'customer'
        ? ',amount'
        : role === 'professional'
          ? ',professional_amount'
          : ',amount,professional_amount,marketplace_fee,provider'
  if (resource === 'professionals' && role === 'admin') columns += ',internal_score'
  return columns
}
function ownership(context: Context, resource: ReadResource): [string, string] | null {
  if (context.role === 'customer' && context.customer_id)
    return ['customer_id', context.customer_id]
  if (context.role === 'professional' && context.professional_id) {
    if (resource === 'jobs' || resource === 'payments')
      return ['professional_id', context.professional_id]
    if (resource === 'professionals') return ['id', context.professional_id]
  }
  return null
}
function project<R extends ReadRole, K extends ReadResource>(
  resource: K,
  role: R,
  value: unknown
): ReadDtoMap<R>[K] {
  let output: unknown
  switch (resource) {
    case 'requests': {
      const r = schemas.requests.parse(value)
      output = {
        id: r.id,
        createdAt: r.created_at,
        status: r.status,
        issueTypeId: r.issue_type_id,
        addressId: r.address_id,
        equipmentId: r.equipment_id,
        preferredDate: r.preferred_date,
        preferredWindow: r.preferred_time_window,
        urgency: r.urgency_level
      }
      break
    }
    case 'jobs': {
      const r = schemas.jobs.parse(value)
      output = {
        id: r.id,
        createdAt: r.created_at,
        requestId: r.request_id,
        status: r.status,
        professionalId: r.professional_id,
        scheduledDate: r.scheduled_date,
        timeWindow: r.scheduled_time_window,
        completedAt: r.completed_at,
        finalAmount: r.final_amount,
        warrantyUntil: r.warranty_until
      }
      break
    }
    case 'payments': {
      const r = schemas.payments.parse(value)
      output = {
        id: r.id,
        createdAt: r.created_at,
        requestId: r.request_id,
        jobId: r.job_id,
        status: r.status,
        currency: r.currency,
        ...(role === 'professional'
          ? { amountToReceive: number.parse(r.professional_amount) }
          : { amount: number.parse(r.amount) }),
        ...(role === 'admin'
          ? {
              marketplaceFee: number.parse(r.marketplace_fee),
              professionalAmount: number.parse(r.professional_amount),
              provider: z.string().parse(r.provider)
            }
          : {})
      }
      break
    }
    case 'equipment': {
      const r = schemas.equipment.parse(value)
      output = {
        id: r.id,
        createdAt: r.created_at,
        nickname: r.nickname,
        type: r.equipment_type,
        brand: r.brand,
        model: r.model
      }
      break
    }
    case 'professionals': {
      const r = schemas.professionals.parse(value)
      output = {
        id: r.id,
        createdAt: r.created_at,
        status: r.status,
        ratingAvg: r.rating_avg,
        jobsCompleted: r.jobs_completed,
        yearsExperience: r.years_experience,
        ...(role === 'admin' ? { internalScore: number.parse(r.internal_score) } : {})
      }
      break
    }
    case 'claims': {
      const r = schemas.claims.parse(value)
      output = {
        id: r.id,
        createdAt: r.created_at,
        jobId: r.job_id,
        status: r.status,
        description: r.description,
        resolution: r.resolution
      }
      break
    }
  }
  // Each branch parses the exact role projection before crossing the DTO boundary.
  return output as ReadDtoMap<R>[K]
}
function validateStatus(resource: ReadResource, status: string | undefined) {
  if (status === undefined) return
  const values =
    resource === 'requests'
      ? Constants.public.Enums.request_status
      : resource === 'jobs'
        ? Constants.public.Enums.job_status
        : resource === 'payments'
          ? Constants.public.Enums.payment_status
          : resource === 'professionals'
            ? Constants.public.Enums.professional_status
            : resource === 'claims'
              ? null
              : []
  if (values !== null && !(values as readonly string[]).includes(status))
    throw new ReadModelError('invalid_input')
}
/** Call with the request's authenticated client. No service key, global cache or fallback fixtures. */
export function createSessionReadRepository<R extends ReadRole>(
  client: SupabaseClient<Database>,
  role: R
): ReadRepository<R> {
  const count = async (
    context: Context,
    resource: ReadResource,
    status?: string,
    activeJobs = false
  ) => {
    let query = client
      .from(definitions[resource].table)
      .select('id', { count: 'exact', head: true })
    const owner = ownership(context, resource)
    if (owner) query = query.filter(owner[0], 'eq', owner[1])
    if (status) query = query.filter('status', 'eq', status)
    if (activeJobs)
      query = query.not(
        'status',
        'in',
        '(completed,cancelled_by_customer,cancelled_by_professional,cancelled_by_admin)'
      )
    const result = await query
    if (result.error || result.count === null) throw new ReadModelError('unavailable')
    return result.count
  }
  const protect = async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      return await operation()
    } catch (error) {
      if (error instanceof ReadModelError) throw error
      throw new ReadModelError('unavailable')
    }
  }
  return {
    list: <K extends ReadResource>(resource: K, options: ReadOptions = {}) =>
      protect(async () => {
        if (!resourceSchema.safeParse(resource).success) throw new ReadModelError('invalid_input')
        const context = await resolveReader(client, role)
        if (!allowed(context, resource)) throw new ReadModelError('forbidden')
        let input: z.infer<typeof optionsSchema>, page: ReturnType<typeof parsePageInput>
        const scopeBase = JSON.stringify([context.profile_id, role, resource])
        try {
          input = optionsSchema.parse(options)
          validateStatus(resource, input.status)
          page = parsePageInput(
            { pageSize: input.pageSize, cursor: input.cursor },
            scopeBase + ':' + (input.status ?? '')
          )
        } catch {
          throw new ReadModelError('invalid_input')
        }
        const scope = scopeBase + ':' + (input.status ?? '')
        let query = client
          .from(definitions[resource].table)
          .select(selection(resource, role))
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(page.pageSize + 1)
        const owner = ownership(context, resource)
        if (owner) query = query.filter(owner[0], 'eq', owner[1])
        if (input.status) query = query.filter('status', 'eq', input.status)
        if (page.cursor)
          query = query.or(
            `created_at.lt.${page.cursor.createdAt},and(created_at.eq.${page.cursor.createdAt},id.lt.${page.cursor.id})`
          )
        const [result, total] = await Promise.all([query, count(context, resource, input.status)])
        if (result.error || !Array.isArray(result.data)) throw new ReadModelError('unavailable')
        const items = result.data.slice(0, page.pageSize).map((row) => project(resource, role, row))
        const last = items.at(-1)
        return {
          items,
          total,
          nextCursor:
            result.data.length > page.pageSize && last
              ? encodeCursor({ id: last.id, createdAt: last.createdAt }, scope)
              : null
        }
      }),
    detail: <K extends ReadResource>(resource: K, id: string) =>
      protect(async () => {
        if (!resourceSchema.safeParse(resource).success || !uuid.safeParse(id).success)
          throw new ReadModelError('invalid_input')
        const context = await resolveReader(client, role)
        if (!allowed(context, resource)) throw new ReadModelError('forbidden')
        const result = await client
          .from(definitions[resource].table)
          .select(selection(resource, role))
          .eq('id', id)
          .maybeSingle()
        if (result.error) throw new ReadModelError('unavailable')
        return result.data ? project(resource, role, result.data) : null
      }),
    metrics: () =>
      protect(async () => {
        const context = await resolveReader(client, role)
        const result: ReadMetrics = { activeJobs: await count(context, 'jobs', undefined, true) }
        for (const resource of resourceSchema.options)
          if (allowed(context, resource)) result[resource] = await count(context, resource)
        return result
      })
  }
}
