import 'server-only'

import { z } from 'zod'

import {
  buildCustomerQuoteSummary,
  buildCustomerServiceSummary,
  customerInitialPaymentState,
  matchesCustomerServicesFilter,
  type CustomerServiceCheckoutSource,
  type CustomerServiceJobSource,
  type CustomerServiceQuoteSource,
  type CustomerServiceSummary,
  type CustomerServiceVisit,
  type CustomerServicesFilter,
  type CustomerServicesPage
} from '@/features/customer/services-view-model'
import type { Session } from '@/lib/auth/session'
import { encodeCursor, parsePageInput, type PagePoint } from '@/lib/data-access/pagination'
import { ApiError } from '@/lib/http/api-error'
import { Constants } from '@/lib/supabase/database.types'
import { isExpiredAutomaticRequest, requestVisitAddress } from '@/lib/jobs/visit-address'

export type CustomerServicesInput = {
  filter?: CustomerServicesFilter
  serviceCursor?: string
  quoteCursor?: string
  pageSize?: number
  source?: 'services' | 'quotes'
}

const inputSchema = z.object({
  filter: z.enum(['all', 'in_progress', 'scheduled', 'finished']).default('all'),
  serviceCursor: z.string().min(1).max(1024).optional(),
  quoteCursor: z.string().min(1).max(1024).optional(),
  pageSize: z.number().int().min(1).max(100).default(25),
  source: z.enum(['services', 'quotes']).optional()
}).strict()
const uuid = z.string().uuid()
const createdAt = z.string().datetime({ offset: true })
const requestSchema = z.object({
  id: uuid, created_at: createdAt, status: z.enum(Constants.public.Enums.request_status),
  issue_type_id: uuid, address_id: uuid.nullable(), equipment_id: uuid.nullable(),
  contract_source: z.literal('automatic_customer_request').nullable().optional(),
  visit_address_snapshot: z.unknown().optional()
})
type RequestRow = z.infer<typeof requestSchema>
const jobSchema = z.object({
  id: uuid, request_id: uuid, status: z.enum(Constants.public.Enums.job_status),
  final_amount: z.number().finite().nullable(), completed_at: createdAt.nullable()
})
const quoteSchema = z.object({
  id: uuid, created_at: createdAt, request_id: uuid.nullable(), status: z.string(),
  expires_at: createdAt,
  quote: z.object({ scope: z.string(), total: z.number().finite().nullable() }),
  address: z.object({ street: z.string(), number: z.string(), city: z.string() }).optional()
})
const checkoutSchema = z.object({ job_id: uuid, extra_id: uuid.nullable(), status: z.string() })
const visitSchema = z.object({
  startsAt: createdAt, endsAt: createdAt,
  timezone: z.literal('America/Argentina/Buenos_Aires'), professionalName: z.string().min(1),
  confirmed: z.literal(true)
})
const issueSchema = z.object({ id: uuid, name: z.string() })
const equipmentSchema = z.object({ id: uuid, nickname: z.string() })
const addressSchema = z.object({ id: uuid, street: z.string(), number: z.string(), city: z.string() })
type QueryResult = { data: unknown; error: unknown }
type SourcePage = { items: CustomerServiceSummary[]; cursor: string | null }

function scope(session: Session, source: 'services' | 'quotes', filter: CustomerServicesFilter) {
  return JSON.stringify([session.profileId, session.customerId, 'customer-services', source, filter])
}
function rows<T>(result: QueryResult, schema: z.ZodType<T>): T[] {
  if (result.error) throw new ApiError('service_unavailable')
  const parsed = z.array(schema).safeParse(result.data)
  if (!parsed.success) throw new ApiError('service_unavailable')
  return parsed.data
}
function toQuote(row: z.infer<typeof quoteSchema>): CustomerServiceQuoteSource {
  return {
    id: row.id, requestId: row.request_id, status: row.status,
    scope: row.quote.scope, total: row.quote.total,
    createdAt: row.created_at, expiresAt: row.expires_at,
    address: row.address ? `${row.address.street} ${row.address.number}, ${row.address.city}` : undefined
  }
}
function point(row: { id: string; created_at: string }): PagePoint {
  return { id: row.id, createdAt: row.created_at }
}
function continuation(position: PagePoint | null) {
  return position
    ? `created_at.lt.${position.createdAt},and(created_at.eq.${position.createdAt},id.lt.${position.id})`
    : null
}

async function hydrateRequests(session: Session, requests: RequestRow[], unavailable: Set<string>, now: string) {
  if (!requests.length) return []
  const owner = session.customerId!
  const requestIds = requests.map((request) => request.id)
  const equipmentIds = [...new Set(requests.flatMap((request) => request.equipment_id ? [request.equipment_id] : []))]
  const addressIds = [...new Set(requests.flatMap((request) => request.address_id ? [request.address_id] : []))]
  const issueIds = [...new Set(requests.map((request) => request.issue_type_id))]
  const empty: QueryResult = { data: [], error: null }
  const related = await Promise.allSettled([
    session.client.from('jobs').select('id,request_id,status,final_amount,completed_at')
      .eq('customer_id', owner).in('request_id', requestIds),
    session.client.from('service_quotes').select('id,created_at,request_id,status,expires_at,quote,address')
      .eq('customer_id', owner).eq('status', 'accepted').in('request_id', requestIds),
    equipmentIds.length ? session.client.from('customer_equipment').select('id,nickname')
      .eq('customer_id', owner).in('id', equipmentIds) : Promise.resolve(empty),
    addressIds.length ? session.client.from('customer_addresses').select('id,street,number,city')
      .eq('customer_id', owner).in('id', addressIds) : Promise.resolve(empty),
    session.client.from('service_issue_types').select('id,name').in('id', issueIds)
  ])
  function optional<T>(index: number, schema: z.ZodType<T>, label: string): T[] {
    try {
      const result = related[index]
      if (result.status !== 'fulfilled') throw new ApiError('service_unavailable')
      return rows(result.value, schema)
    } catch {
      unavailable.add(label)
      return []
    }
  }
  const jobResult = related[0]
  if (jobResult.status !== 'fulfilled') throw new ApiError('service_unavailable')
  const jobs = rows(jobResult.value, jobSchema)
  const quotes = optional(1, quoteSchema, 'presupuestos')
  const equipment = optional(2, equipmentSchema, 'equipos')
  const addresses = optional(3, addressSchema, 'domicilios')
  const issues = optional(4, issueSchema, 'tipos de servicio')
  const jobIds = jobs.map((job) => job.id)
  let checkouts: CustomerServiceCheckoutSource[] = []
  let paymentState: 'ready' | 'error' = 'ready'
  if (jobIds.length) {
    try {
      const checkoutResult = await session.client.from('marketplace_checkouts').select('job_id,extra_id,status')
        .eq('customer_id', owner).is('extra_id', null).in('job_id', jobIds)
      // The canonical target index permits one initial checkout per job.
      checkouts = rows(checkoutResult, checkoutSchema).map((checkout) => ({
        jobId: checkout.job_id, extraId: checkout.extra_id, status: checkout.status
      }))
    } catch {
      unavailable.add('pagos')
      paymentState = 'error'
    }
  }
  const visits = new Map<string, CustomerServiceVisit>()
  const requestById = new Map(requests.map((request) => [request.id, request]))
  await Promise.all(jobs.filter((job) => !isExpiredAutomaticRequest({
    status: requestById.get(job.request_id)?.status,
    contractSource: requestById.get(job.request_id)?.contract_source
  }) && job.status === 'confirmed' && paymentState === 'ready' &&
    customerInitialPaymentState(checkouts, job.id) === 'approved')
    .map(async (job) => {
      try {
        const result = await session.client.rpc('get_job_visit', { p_job_id: job.id })
        if (result.error) throw new ApiError('service_unavailable')
        const parsed = visitSchema.nullable().safeParse(result.data)
        if (!parsed.success) throw new ApiError('service_unavailable')
        if (parsed.data) visits.set(job.id, {
          startsAt: parsed.data.startsAt, endsAt: parsed.data.endsAt,
          timezone: parsed.data.timezone, professionalName: parsed.data.professionalName
        })
      } catch {
        unavailable.add('visitas')
      }
    }))
  const jobByRequest = new Map(jobs.map((job) => [job.request_id, job]))
  const quoteByRequest = new Map(quotes.map((quote) => [quote.request_id, toQuote(quote)]))
  const equipmentById = new Map(equipment.map((item) => [item.id, item.nickname]))
  const addressById = new Map(addresses.map((item) => [item.id, `${item.street} ${item.number}, ${item.city}`]))
  const issueById = new Map(issues.map((item) => [item.id, item.name]))
  return requests.map((request) => {
    const rawJob = jobByRequest.get(request.id)
    const job: CustomerServiceJobSource | undefined = rawJob ? {
      id: rawJob.id, requestId: rawJob.request_id, status: rawJob.status,
      finalAmount: rawJob.final_amount, completedAt: rawJob.completed_at
    } : undefined
    return buildCustomerServiceSummary({
      request: {
        id: request.id, status: request.status, createdAt: request.created_at,
        issueLabel: issueById.get(request.issue_type_id),
        equipmentName: request.equipment_id ? equipmentById.get(request.equipment_id) : undefined,
        contractSource: request.contract_source,
        address: requestVisitAddress({ contractSource: request.contract_source, visitAddressSnapshot: request.visit_address_snapshot },
          request.address_id ? addressById.get(request.address_id) : undefined)
      }, job, quote: quoteByRequest.get(request.id), checkouts, paymentState,
      visit: job ? visits.get(job.id) ?? null : null
    }, now)
  })
}

async function scanServices(
  session: Session, filter: CustomerServicesFilter, pageSize: number, initial: PagePoint | null,
  unavailable: Set<string>, now: string
): Promise<SourcePage> {
  const items: CustomerServiceSummary[] = []
  let position = initial
  const queryScope = scope(session, 'services', filter)
  for (let batch = 0; batch < 4; batch++) {
    let query = session.client.from('service_requests')
      .select('id,created_at,status,issue_type_id,address_id,equipment_id,contract_source,visit_address_snapshot')
      .eq('customer_id', session.customerId!).order('created_at', { ascending: false })
      .order('id', { ascending: false }).limit(pageSize + 1)
    const expression = continuation(position)
    if (expression) query = query.or(expression)
    const data = rows(await query, requestSchema)
    const examined = data.slice(0, pageSize)
    const summaries = await hydrateRequests(session, examined, unavailable, now)
    for (let index = 0; index < examined.length; index++) {
      position = point(examined[index])
      // Keep old unsubmitted rows in storage, not in the contracted-services hub.
      // Advance the real scan cursor so filtering cannot strand older real jobs.
      if (!summaries[index].jobId && ['draft', 'diagnosis_completed', 'address_completed', 'schedule_completed', 'price_selected'].includes(examined[index].status)) continue
      if (matchesCustomerServicesFilter(summaries[index], filter)) items.push(summaries[index])
      if (items.length === pageSize) {
        const more = index < examined.length - 1 || data.length > pageSize
        return { items, cursor: more ? encodeCursor(position, queryScope) : null }
      }
    }
    if (data.length <= pageSize) return { items, cursor: null }
  }
  return { items, cursor: position ? encodeCursor(position, queryScope) : null }
}

async function scanQuotes(
  session: Session, filter: CustomerServicesFilter, pageSize: number, initial: PagePoint | null, now: string
): Promise<SourcePage> {
  const items: CustomerServiceSummary[] = []
  let position = initial
  const queryScope = scope(session, 'quotes', filter)
  for (let batch = 0; batch < 4; batch++) {
    let query = session.client.from('service_quotes')
      .select('id,created_at,request_id,status,expires_at,quote,address')
      .eq('customer_id', session.customerId!).is('request_id', null).neq('status', 'superseded')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(pageSize + 1)
    const expression = continuation(position)
    if (expression) query = query.or(expression)
    const data = rows(await query, quoteSchema)
    const examined = data.slice(0, pageSize)
    for (let index = 0; index < examined.length; index++) {
      position = point(examined[index])
      const summary = buildCustomerQuoteSummary(toQuote(examined[index]), now)
      if (summary && matchesCustomerServicesFilter(summary, filter)) items.push(summary)
      if (items.length === pageSize) {
        const more = index < examined.length - 1 || data.length > pageSize
        return { items, cursor: more ? encodeCursor(position, queryScope) : null }
      }
    }
    if (data.length <= pageSize) return { items, cursor: null }
  }
  return { items, cursor: position ? encodeCursor(position, queryScope) : null }
}

export async function loadCustomerServices(
  session: Session,
  input: CustomerServicesInput = {},
  now = new Date().toISOString()
): Promise<CustomerServicesPage> {
  if (session.role !== 'customer' || !session.customerId) throw new ApiError('forbidden')
  let parsed: z.infer<typeof inputSchema>
  let servicePosition: PagePoint | null
  let quotePosition: PagePoint | null
  try {
    parsed = inputSchema.parse(input)
    servicePosition = parsePageInput({ pageSize: parsed.pageSize, cursor: parsed.serviceCursor }, scope(session, 'services', parsed.filter)).cursor
    quotePosition = parsePageInput({ pageSize: parsed.pageSize, cursor: parsed.quoteCursor }, scope(session, 'quotes', parsed.filter)).cursor
  } catch {
    throw new ApiError('invalid_input')
  }
  const unavailable = new Set<string>()
  const empty: SourcePage = { items: [], cursor: null }
  const [services, quotes] = await Promise.allSettled([
    parsed.source === 'quotes' ? Promise.resolve(empty) : scanServices(session, parsed.filter, parsed.pageSize, servicePosition, unavailable, now),
    parsed.source === 'services' || parsed.filter === 'scheduled' || parsed.filter === 'finished'
      ? Promise.resolve(empty) : scanQuotes(session, parsed.filter, parsed.pageSize, quotePosition, now)
  ])
  if (services.status === 'rejected') unavailable.add('servicios')
  if (quotes.status === 'rejected') unavailable.add('presupuestos')
  return {
    items: [...(services.status === 'fulfilled' ? services.value.items : []),
      ...(quotes.status === 'fulfilled' ? quotes.value.items : [])],
    nextServiceCursor: services.status === 'fulfilled' ? services.value.cursor : null,
    nextQuoteCursor: quotes.status === 'fulfilled' ? quotes.value.cursor : null,
    unavailableSections: [...unavailable]
  }
}
