import 'server-only'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
import { encodeCursor, parsePageInput } from '@/lib/data-access/pagination'

export const adminPermissionSchema = z.enum(['operations', 'finance', 'quality', 'owner'])
export const changePermissionsSchema = z
  .object({
    adminProfileId: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
    permissions: z
      .array(adminPermissionSchema)
      .max(4)
      .refine((value) => new Set(value).size === value.length),
    reason: z.string().trim().min(10).max(1000)
  })
  .strict()
const accountSchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.string().datetime({ offset: true }),
    firstName: z.string(),
    lastName: z.string(),
    version: z.number().int().positive(),
    permissions: z.array(adminPermissionSchema)
  })
  .strict()
const auditSchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.string().datetime({ offset: true }),
    actorProfileId: z.string().uuid().nullable(),
    action: z.string(),
    entityType: z.string(),
    entityId: z.string().uuid().nullable(),
    metadata: z.record(z.unknown())
  })
  .strict()
export type AdminAccount = z.infer<typeof accountSchema>
export type AdminAuditRecord = z.infer<typeof auditSchema>
export type AdminPage<T> = { items: T[]; total: number; nextCursor: string | null }
function failure(code: string, message?: string): never {
  if (code === '40001' && message === 'Cannot remove the final usable owner')
    throw new ApiError('last_owner')
  if (code === '42501') throw new ApiError('forbidden')
  if (code === 'P0002') throw new ApiError('not_found')
  if (code === '40001') throw new ApiError('conflict')
  if (['22023', '22P02', '23514'].includes(code)) throw new ApiError('invalid_input')
  throw new ApiError('service_unavailable')
}
function requireAdmin(session: Session, owner = false) {
  if (
    session.role !== 'admin' ||
    session.assuranceLevel !== 'aal2' ||
    !session.permissions.length ||
    (owner && !session.permissions.includes('owner'))
  )
    throw new ApiError('forbidden')
}
export async function changeAdminPermissions(session: Session, input: unknown) {
  requireAdmin(session, true)
  const data = changePermissionsSchema.parse(input)
  const result = await session.client.rpc('change_admin_permissions', {
    p_admin_profile_id: data.adminProfileId,
    p_expected_version: data.expectedVersion,
    p_permissions: data.permissions,
    p_reason: data.reason
  })
  if (result.error) failure(result.error.code, result.error.message)
  const parsed = accountSchema.safeParse(result.data)
  if (!parsed.success) throw new ApiError('service_unavailable')
  return { account: parsed.data }
}
export async function listAdminWorkflow(
  session: Session,
  resource: 'permissions',
  input?: unknown
): Promise<AdminPage<AdminAccount>>
export async function listAdminWorkflow(
  session: Session,
  resource: 'audit',
  input?: unknown
): Promise<AdminPage<AdminAuditRecord>>
export async function listAdminWorkflow(
  session: Session,
  resource: 'permissions' | 'audit',
  input: unknown = {}
) {
  requireAdmin(session, resource === 'permissions')
  const scope = `admin:${session.profileId}:${[...session.permissions].sort().join(',')}:${resource}`
  let page: ReturnType<typeof parsePageInput>
  try {
    page = parsePageInput(input, scope)
  } catch {
    throw new ApiError('invalid_input')
  }
  const result = await session.client.rpc('list_admin_workflow', {
    p_resource: resource,
    p_limit: page.pageSize,
    p_cursor_at: (page.cursor?.createdAt ?? null)!,
    p_cursor_id: (page.cursor?.id ?? null)!
  })
  if (result.error) failure(result.error.code, result.error.message)
  const parsed = z
    .object({
      items: z.array(resource === 'permissions' ? accountSchema : auditSchema).max(101),
      total: z.number().int().nonnegative()
    })
    .strict()
    .safeParse(result.data)
  if (!parsed.success) throw new ApiError('service_unavailable')
  const items = parsed.data.items.slice(0, page.pageSize),
    last = items.at(-1)
  return {
    items,
    total: parsed.data.total,
    nextCursor: parsed.data.items.length > page.pageSize && last
      ? encodeCursor({ id: last.id, createdAt: last.createdAt }, scope)
      : null
  }
}
export function adminPageQuery(request: Request) {
  return z
    .object({ cursor: z.string().optional(), pageSize: z.coerce.number().optional() })
    .strict()
    .parse(Object.fromEntries(new URL(request.url).searchParams))
}
