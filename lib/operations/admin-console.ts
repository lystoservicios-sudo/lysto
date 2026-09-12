import 'server-only'

import type { Session } from '@/lib/auth/session'
import { createAdminQueries } from '@/lib/data-access/admin-queries'
import type { ReadOptions, ReadResource } from '@/lib/data-access/read-contracts'
import { ApiError } from '@/lib/http/api-error'
import { encodeCursor, parsePageInput } from '@/lib/data-access/pagination'

function requireScope(session: Session, scope: 'operations' | 'finance' | 'quality') {
  if (
    session.role !== 'admin' ||
    session.assuranceLevel !== 'aal2' ||
    !session.permissions.some((item) => item === scope || item === 'owner')
  )
    throw new ApiError('forbidden')
}
export async function adminResource(
  session: Session,
  resource: ReadResource,
  input: ReadOptions = {}
) {
  const scope =
    resource === 'payments' ? 'finance' : resource === 'claims' ? 'quality' : 'operations'
  requireScope(session, scope)
  return createAdminQueries(session.client).list(resource, input)
}
export async function adminCatalog(session: Session) {
  requireScope(session, 'operations')
  const [categories, issues, questions, zones] = await Promise.all([
    session.client
      .from('service_categories')
      .select('id,slug,name,description,active,updated_at')
      .order('name'),
    session.client
      .from('service_issue_types')
      .select('id,category_id,slug,name,description,active,sort_order,updated_at')
      .order('sort_order'),
    session.client
      .from('service_questions')
      .select(
        'id,category_id,issue_type_id,code,label,input_type,required,active,sort_order,updated_at'
      )
      .order('sort_order'),
    session.client.from('service_zones').select('*').limit(100)
  ])
  if (categories.error || issues.error || questions.error || zones.error)
    throw new ApiError('service_unavailable')
  return {
    categories: categories.data ?? [],
    issues: issues.data ?? [],
    questions: questions.data ?? [],
    zones: zones.data ?? []
  }
}
export async function adminCustomers(session: Session, input: unknown = {}) {
  requireScope(session, 'operations')
  let page: ReturnType<typeof parsePageInput>
  try {
    page = parsePageInput(input, `admin-customers:${session.profileId}`)
  } catch {
    throw new ApiError('invalid_input')
  }
  let query = session.client
    .from('customer_profiles')
    .select('id,profile_id,created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(page.pageSize + 1)
  if (page.cursor)
    query = query.or(
      `created_at.lt.${page.cursor.createdAt},and(created_at.eq.${page.cursor.createdAt},id.lt.${page.cursor.id})`
    )
  const [result, count] = await Promise.all([
    query,
    session.client.from('customer_profiles').select('id', { count: 'exact', head: true })
  ])
  if (result.error || !result.data || count.error || count.count === null)
    throw new ApiError('service_unavailable')
  const selected = result.data.slice(0, page.pageSize)
  const profiles = selected.length
    ? await session.client
        .from('profiles')
        .select('id,first_name,last_name,email,phone')
        .in(
          'id',
          selected.map((item) => item.profile_id)
        )
    : { data: [], error: null }
  if (profiles.error || !profiles.data) throw new ApiError('service_unavailable')
  const byId = new Map(profiles.data.map((item) => [item.id, item]))
  const items = selected.map((item) => ({
    id: item.id,
    createdAt: item.created_at,
    ...byId.get(item.profile_id)
  }))
  const last = items.at(-1)
  return {
    items,
    total: count.count,
    nextCursor:
      result.data.length > page.pageSize && last
        ? encodeCursor(
            { id: last.id, createdAt: last.createdAt },
            `admin-customers:${session.profileId}`
          )
        : null
  }
}
export async function adminCustomerDetail(session: Session, id: string) {
  requireScope(session, 'operations')
  const customer = await session.client
    .from('customer_profiles')
    .select('id,profile_id,created_at')
    .eq('id', id)
    .maybeSingle()
  if (customer.error) throw new ApiError('service_unavailable')
  if (!customer.data) return null
  const [profile, requests, equipment] = await Promise.all([
    session.client
      .from('profiles')
      .select('first_name,last_name,email,phone')
      .eq('id', customer.data.profile_id)
      .single(),
    session.client
      .from('service_requests')
      .select('id,status,created_at')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(25),
    session.client
      .from('customer_equipment')
      .select('id,nickname,brand,model,archived_at')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(25)
  ])
  if (profile.error || requests.error || equipment.error || !profile.data)
    throw new ApiError('service_unavailable')
  return {
    customer: customer.data,
    profile: profile.data,
    requests: requests.data ?? [],
    equipment: equipment.data ?? []
  }
}
