import 'server-only'
import { z } from 'zod'
import { requireAdminPermission, type Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
import { throwPricingDatabaseError } from '@/lib/pricing/server'
import { adminRequestSchema, type AdminRequestOptions, type AdminRequestRecord } from './service-request-contract'
import { encodeCursor, parsePageInput } from '@/lib/data-access/pagination'

export async function requireAdminRequestManagement(session: Session) {
  await requireAdminPermission('operations', session)
  await requireAdminPermission('finance', session)
}
type AdminRequestPage = { items: AdminRequestRecord[]; total: number; nextCursor: string | null }
export function readAdminRequests(session: Session, id: string): Promise<AdminRequestRecord>
export function readAdminRequests(session: Session, id?: undefined, options?: { cursor?: string }): Promise<AdminRequestPage>
export function readAdminRequests(session: Session, id?: string, options?: { cursor?: string }): Promise<AdminRequestRecord | AdminRequestPage>
export async function readAdminRequests(session: Session, id?: string, options: { cursor?: string } = {}): Promise<AdminRequestRecord | AdminRequestPage> {
  await requireAdminRequestManagement(session)
  if (id) z.string().uuid().parse(id)
  const scope = `admin-managed-requests:${session.profileId}`
  let page: ReturnType<typeof parsePageInput>
  try { page = parsePageInput({ cursor: options.cursor, pageSize: 25 }, scope) }
  catch { throw new ApiError('invalid_input') }
  const { data, error } = await session.client.rpc('read_admin_service_requests', {
    p_id: id, p_limit: page.pageSize, p_cursor_at: page.cursor?.createdAt, p_cursor_id: page.cursor?.id
  })
  if (error) throwPricingDatabaseError(error)
  if (!data) throw new ApiError('service_unavailable')
  if (id) return data as unknown as AdminRequestRecord
  const result = data as unknown as { items: AdminRequestRecord[]; total: number }
  if (!Array.isArray(result.items) || !Number.isInteger(result.total) || result.total < 0) throw new ApiError('service_unavailable')
  const items = result.items.slice(0, page.pageSize), last = items.at(-1)
  return { items, total: result.total, nextCursor: result.items.length > page.pageSize && last
    ? encodeCursor({ id: z.string().uuid().parse(last.id), createdAt: z.string().datetime({ offset: true }).parse(last.updatedAt) }, scope) : null }
}
export async function saveAdminRequest(session: Session, input: unknown) {
  await requireAdminRequestManagement(session)
  const command = adminRequestSchema.parse(input)
  const { data, error } = await session.client.rpc('save_admin_service_request', { p_input: command })
  if (error) throwPricingDatabaseError(error)
  if (!data) throw new ApiError('service_unavailable')
  return data as unknown as AdminRequestRecord
}
export async function adminRequestOptions(session: Session, input: unknown) {
  await requireAdminRequestManagement(session)
  const query = z.object({ customerId: z.string().uuid().optional(), search: z.string().trim().max(100).default('') }).strict().parse(input)
  const { data, error } = await session.client.rpc('admin_service_request_options', { p_customer_id: query.customerId, p_search: query.search })
  if (error) throwPricingDatabaseError(error)
  if (!data) throw new ApiError('service_unavailable')
  return data as unknown as AdminRequestOptions
}
