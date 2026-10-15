import 'server-only'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { encodeCursor, parsePageInput } from '@/lib/data-access/pagination'
import { ApiError } from '@/lib/http/api-error'
import type { SupportCaseView, SupportJobOption, WarrantyService } from './customer-content'

const uuid = z.string().uuid()
function customer(session: Session) {
  if (session.role !== 'customer' || !session.customerId) throw new ApiError('forbidden')
  return session.customerId
}
const caseColumns = 'id,job_id,category,status,description,public_resolution,version,created_at' as const
export async function loadCustomerCases(session: Session, input: { cursor?: string; state?: 'open' | 'closed' } = {}) {
  const owner = customer(session), scope = `customer-support:${owner}:${input.state ?? 'all'}`
  let page: ReturnType<typeof parsePageInput>
  try { page = parsePageInput({ pageSize: 30, ...(input.cursor ? { cursor: input.cursor } : {}) }, scope) }
  catch { throw new ApiError('invalid_input') }
  let query = session.client.from('complaints').select(caseColumns).eq('customer_id', owner)
  if (input.state === 'closed') query = query.in('status', ['resolved', 'rejected'])
  if (input.state === 'open') query = query.not('status', 'in', '(resolved,rejected)')
  if (page.cursor) query = query.or(`created_at.lt.${page.cursor.createdAt},and(created_at.eq.${page.cursor.createdAt},id.lt.${page.cursor.id})`)
  const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(page.pageSize + 1)
  if (error || !data) throw new ApiError('service_unavailable')
  const items = data.slice(0, page.pageSize).map(row => ({ id: row.id, jobId: row.job_id, category: row.category, status: row.status, description: row.description, publicResolution: row.public_resolution, version: row.version, createdAt: row.created_at }))
  const last = items.at(-1)
  return { items, nextCursor: data.length > page.pageSize && last ? encodeCursor({ id: last.id, createdAt: last.createdAt }, scope) : null }
}

/** Detail is an owned point lookup, not a search within a truncated case list. */
export async function readCustomerCase(session: Session, id: string): Promise<SupportCaseView | null> {
  const owner = customer(session)
  if (!uuid.safeParse(id).success) return null
  const result = await session.client.from('complaints').select(caseColumns).eq('id', id).eq('customer_id', owner).maybeSingle()
  if (result.error) throw new ApiError('service_unavailable')
  if (!result.data) return null
  const [events, warranty] = await Promise.all([
    session.client.from('support_case_events').select('id,event_type,from_status,to_status,public_message,evidence_ids,created_at').eq('case_id', id).order('created_at', { ascending: true }).order('id', { ascending: true }),
    session.client.from('warranty_claims').select('id,status,coverage_eligible,coverage_until,revisit_job_id').eq('complaint_id', id).eq('customer_id', owner).maybeSingle()
  ])
  if (events.error || !events.data || warranty.error) throw new ApiError('service_unavailable')
  const row = result.data, claim = warranty.data
  return { id: row.id, jobId: row.job_id, category: row.category, status: row.status, description: row.description, publicResolution: row.public_resolution, version: row.version, createdAt: row.created_at,
    warrantyClaim: claim ? { id: claim.id, status: claim.status, coverageEligible: claim.coverage_eligible, coverageUntil: claim.coverage_until, revisitJobId: claim.revisit_job_id } : null,
    events: events.data.map(e => ({ id: e.id, type: e.event_type, fromStatus: e.from_status, toStatus: e.to_status, message: e.public_message, evidenceIds: e.evidence_ids, createdAt: e.created_at })) }
}

export async function loadSupportJobs(session: Session, completedOnly = false, prefill?: string): Promise<SupportJobOption[]> {
  const owner = customer(session)
  let query = session.client.from('jobs').select('id,request_id,status,created_at').eq('customer_id', owner)
  if (completedOnly) query = query.eq('status', 'completed')
  const result = await query.order('created_at', { ascending: false }).limit(100)
  if (result.error || !result.data) throw new ApiError('service_unavailable')
  if (prefill && uuid.safeParse(prefill).success && !result.data.some(j => j.id === prefill)) {
    const selected = await session.client.from('jobs').select('id,request_id,status,created_at').eq('customer_id', owner).eq('id', prefill).maybeSingle()
    if (selected.error) throw new ApiError('service_unavailable')
    if (selected.data && (!completedOnly || selected.data.status === 'completed')) result.data.unshift(selected.data)
  }
  if (!result.data.length) return []
  const requests = await session.client.from('service_requests').select('id,issue_type_id').eq('customer_id', owner).in('id', [...new Set(result.data.map(j => j.request_id))])
  if (requests.error || !requests.data) throw new ApiError('service_unavailable')
  const ids = [...new Set(requests.data.map(r => r.issue_type_id))]
  const issues = ids.length ? await session.client.from('service_issue_types').select('id,name').in('id', ids) : { data: [], error: null }
  if (issues.error || !issues.data) throw new ApiError('service_unavailable')
  const issueMap = new Map(issues.data.map(i => [i.id, i.name])), requestMap = new Map(requests.data.map(r => [r.id, issueMap.get(r.issue_type_id)]))
  return result.data.map(j => ({ id: j.id, requestId: j.request_id, label: `${requestMap.get(j.request_id) ?? 'Servicio técnico'} · ${new Date(j.created_at).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}` }))
}

export async function loadWarrantyServices(session: Session, input: { cursor?: string; id?: string } = {}) {
  const owner = customer(session), scope = `customer-warranty:${owner}`
  if (input.id && !uuid.safeParse(input.id).success) return { items: [], nextCursor: null }
  let page: ReturnType<typeof parsePageInput>
  try { page = parsePageInput({ pageSize: 30, ...(input.cursor ? { cursor: input.cursor } : {}) }, scope) }
  catch { throw new ApiError('invalid_input') }
  let query = session.client.from('jobs').select('id,request_id,created_at,completed_at,warranty_until').eq('customer_id', owner).eq('status', 'completed')
  if (input.id) query = query.eq('id', input.id)
  if (page.cursor) query = query.or(`created_at.lt.${page.cursor.createdAt},and(created_at.eq.${page.cursor.createdAt},id.lt.${page.cursor.id})`)
  const result = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(page.pageSize + 1)
  if (result.error || !result.data) throw new ApiError('service_unavailable')
  const jobs = result.data.slice(0, page.pageSize)
  if (!jobs.length) return { items: [], nextCursor: null }
  const [requests, claims] = await Promise.all([
    session.client.from('service_requests').select('id,issue_type_id,equipment_id').eq('customer_id', owner).in('id', [...new Set(jobs.map(j => j.request_id))]),
    session.client.from('warranty_claims').select('id,job_id,complaint_id,status,description,resolution').eq('customer_id', owner).in('job_id', jobs.map(j => j.id))
  ])
  if (requests.error || !requests.data || claims.error || !claims.data) throw new ApiError('service_unavailable')
  const issueIds = [...new Set(requests.data.map(r => r.issue_type_id))], equipmentIds = [...new Set(requests.data.flatMap(r => r.equipment_id ? [r.equipment_id] : []))]
  const [issues, equipment] = await Promise.all([
    issueIds.length ? session.client.from('service_issue_types').select('id,name').in('id', issueIds) : { data: [], error: null },
    equipmentIds.length ? session.client.from('customer_equipment').select('id,nickname').eq('customer_id', owner).in('id', equipmentIds) : { data: [], error: null }
  ])
  if (issues.error || !issues.data || equipment.error || !equipment.data) throw new ApiError('service_unavailable')
  const requestsById = new Map(requests.data.map(r => [r.id, r])), issuesById = new Map(issues.data.map(r => [r.id, r.name])), equipmentById = new Map(equipment.data.map(r => [r.id, r.nickname])), claimsByJob = new Map(claims.data.map(r => [r.job_id, r]))
  const items: WarrantyService[] = jobs.map(j => {
    const request = requestsById.get(j.request_id), claim = claimsByJob.get(j.id)
    return { id: j.id, requestId: j.request_id, label: request ? issuesById.get(request.issue_type_id) ?? 'Servicio técnico' : 'Servicio técnico', equipment: request?.equipment_id ? equipmentById.get(request.equipment_id) ?? 'Equipo del servicio' : 'Equipo del servicio', completedAt: j.completed_at, warrantyUntil: j.warranty_until,
      claim: claim ? { id: claim.id, caseId: claim.complaint_id, status: claim.status, description: claim.description, resolution: claim.resolution } : null }
  })
  const last = jobs.at(-1)
  return { items, nextCursor: result.data.length > page.pageSize && last ? encodeCursor({ id: last.id, createdAt: last.created_at }, scope) : null }
}
