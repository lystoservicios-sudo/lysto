import 'server-only'

import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { encodeCursor, parsePageInput } from '@/lib/data-access/pagination'
import { ApiError } from '@/lib/http/api-error'

const row = z.object({
  id: z.string().uuid(),
  entity_type: z.enum(['request', 'job', 'support_case']),
  created_at: z.string().datetime({ offset: true }),
  status: z.string(),
  priority: z.string(),
  assigned_to: z.string().uuid().nullable(),
  next_action: z.string(),
  due_at: z.string().datetime({ offset: true }).nullable()
})
export type OperatorQueueItem = {
  id: string
  entityType: 'request' | 'job' | 'support_case'
  createdAt: string
  status: string
  priority: string
  assignedTo: string | null
  nextAction: string
  dueAt: string | null
}

export async function listOperatorQueue(session: Session, input: unknown = {}) {
  if (
    session.role !== 'admin' ||
    session.assuranceLevel !== 'aal2' ||
    !session.permissions.some((p) => p === 'operations' || p === 'owner')
  )
    throw new ApiError('forbidden')
  let page: ReturnType<typeof parsePageInput>
  try {
    page = parsePageInput(input, `operator-queue:${session.profileId}`)
  } catch {
    throw new ApiError('invalid_input')
  }
  const result = await session.client.rpc(
    'list_operator_queue' as never,
    {
      p_limit: page.pageSize,
      p_cursor_at: page.cursor?.createdAt ?? null,
      p_cursor_id: page.cursor?.id ?? null
    } as never
  )
  if (result.error)
    throw new ApiError(result.error.code === '42501' ? 'forbidden' : 'service_unavailable')
  const parsed = z
    .object({ items: z.array(row).max(101), total: z.number().int().nonnegative() })
    .parse(result.data)
  const selected = parsed.items.slice(0, page.pageSize)
  const items = selected.map(
    (item): OperatorQueueItem => ({
      id: item.id,
      entityType: item.entity_type,
      createdAt: item.created_at,
      status: item.status,
      priority: item.priority,
      assignedTo: item.assigned_to,
      nextAction: item.next_action,
      dueAt: item.due_at
    })
  )
  const last = items.at(-1)
  return {
    items,
    total: parsed.total,
    nextCursor:
      parsed.items.length > page.pageSize && last
        ? encodeCursor(
            { id: last.id, createdAt: last.createdAt },
            `operator-queue:${session.profileId}`
          )
        : null
  }
}
