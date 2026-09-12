import 'server-only'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
import { encodeCursor, parsePageInput } from '@/lib/data-access/pagination'

const stateSchema = z.enum(['queued', 'leased', 'processed', 'dead_letter', 'suppressed', 'manual'])
const itemSchema = z
  .object({
    id: z.string().uuid(),
    eventType: z.string().min(1).max(200),
    channel: z.enum(['in_app', 'email', 'whatsapp_manual', 'push']),
    createdAt: z.string().datetime({ offset: true }),
    availableAt: z.string().datetime({ offset: true }),
    attemptCount: z.number().int().nonnegative(),
    maxAttempts: z.number().int().positive(),
    state: stateSchema,
    lastError: z
      .string()
      .regex(/^[a-z_0-9 ]{1,200}$/)
      .nullable(),
    providerAccepted: z.boolean(),
    version: z.number().int().positive()
  })
  .strict()
const countsSchema = z
  .object({
    queued: z.number().int().nonnegative(),
    leased: z.number().int().nonnegative(),
    processed: z.number().int().nonnegative(),
    deadLetter: z.number().int().nonnegative(),
    suppressed: z.number().int().nonnegative(),
    manual: z.number().int().nonnegative()
  })
  .strict()
const retrySchema = z
  .object({
    eventId: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(10).max(1000)
  })
  .strict()
export type NotificationDelivery = z.infer<typeof itemSchema>
export type NotificationDeliveryPage = {
  items: NotificationDelivery[]
  total: number
  counts: z.infer<typeof countsSchema>
  nextCursor: string | null
}

function requireOperations(session: Session) {
  if (
    session.role !== 'admin' ||
    session.assuranceLevel !== 'aal2' ||
    !session.permissions.some((value) => value === 'operations' || value === 'owner')
  )
    throw new ApiError('forbidden')
}
function databaseFailure(code?: string): never {
  if (code === '42501') throw new ApiError('forbidden')
  if (code === 'P0002') throw new ApiError('not_found')
  if (code === '40001') throw new ApiError('conflict')
  if (code?.startsWith('22') || code === '23514') throw new ApiError('invalid_input')
  throw new ApiError('service_unavailable')
}
export async function listNotificationDeliveries(
  session: Session,
  input: unknown = {}
): Promise<NotificationDeliveryPage> {
  requireOperations(session)
  const scope = `outbox:${session.profileId}`
  let page: ReturnType<typeof parsePageInput>
  try {
    page = parsePageInput(input, scope)
  } catch {
    throw new ApiError('invalid_input')
  }
  const result = await session.client.rpc('list_outbox_deliveries', {
    p_limit: page.pageSize,
    p_cursor_at: (page.cursor?.createdAt ?? null)!,
    p_cursor_id: (page.cursor?.id ?? null)!
  })
  if (result.error) databaseFailure(result.error.code)
  const parsed = z
    .object({
      items: z.array(itemSchema).max(101),
      total: z.number().int().nonnegative(),
      counts: countsSchema
    })
    .strict()
    .safeParse(result.data)
  if (!parsed.success) throw new ApiError('service_unavailable')
  const items = parsed.data.items.slice(0, page.pageSize),
    last = items.at(-1)
  return {
    ...parsed.data,
    items,
    nextCursor:
      parsed.data.items.length > page.pageSize && last
        ? encodeCursor({ id: last.id, createdAt: last.createdAt }, scope)
        : null
  }
}
export async function retryNotificationDelivery(session: Session, input: unknown) {
  requireOperations(session)
  const data = retrySchema.parse(input)
  const result = await session.client.rpc('retry_outbox_delivery', {
    p_event_id: data.eventId,
    p_expected_revision: data.expectedVersion,
    p_reason: data.reason
  })
  if (result.error) databaseFailure(result.error.code)
  const parsed = itemSchema.safeParse(result.data)
  if (!parsed.success) throw new ApiError('service_unavailable')
  return { delivery: parsed.data }
}
export function notificationPageQuery(request: Request) {
  return z
    .object({ cursor: z.string().optional(), pageSize: z.coerce.number().optional() })
    .strict()
    .parse(Object.fromEntries(new URL(request.url).searchParams))
}
