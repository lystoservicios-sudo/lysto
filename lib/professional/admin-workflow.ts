import 'server-only'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
import { encodeCursor, parsePageInput } from '@/lib/data-access/pagination'
import { invitationSchema } from './onboarding-service'

const professionalSchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.string().datetime({ offset: true }),
    version: z.number().int().positive(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    status: z.enum([
      'invited',
      'form_started',
      'form_submitted',
      'under_review',
      'approved',
      'rejected',
      'suspended',
      'inactive'
    ]),
    eligible: z.boolean(),
    readyForNewWork: z.boolean().optional(),
    invited: z.boolean()
  })
  .strict()
export type ProfessionalSummary = z.infer<typeof professionalSchema>
export type InvitationSummary = z.infer<typeof invitationSchema>
export type WorkflowPage<T> = { items: T[]; total: number; nextCursor: string | null }
export async function listProfessionalWorkflow(
  session: Session,
  resource: 'invitations',
  input?: unknown
): Promise<WorkflowPage<InvitationSummary>>
export async function listProfessionalWorkflow(
  session: Session,
  resource: 'professionals',
  input?: unknown
): Promise<WorkflowPage<ProfessionalSummary>>
export async function listProfessionalWorkflow(
  session: Session,
  resource: 'invitations' | 'professionals',
  input: unknown = {}
) {
  if (
    session.role !== 'admin' ||
    session.assuranceLevel !== 'aal2' ||
    !session.permissions.some((value) => ['owner', 'operations'].includes(value))
  )
    throw new ApiError('forbidden')
  const scope = `professional-workflow:${session.profileId}:${resource}`
  let page: ReturnType<typeof parsePageInput>
  try {
    page = parsePageInput(input, scope)
  } catch {
    throw new ApiError('invalid_input')
  }
  const result = await session.client.rpc('list_professional_workflow', {
    p_resource: resource,
    p_limit: page.pageSize,
    p_before_created_at: (page.cursor?.createdAt ?? null)!,
    p_before_id: (page.cursor?.id ?? null)!
  })
  if (result.error)
    throw new ApiError(result.error.code === '42501' ? 'forbidden' : 'service_unavailable')
  const parsed = z
    .object({
      items: z.array(resource === 'invitations' ? invitationSchema : professionalSchema).max(101),
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
    nextCursor:
      parsed.data.items.length > page.pageSize && last
        ? encodeCursor({ id: last.id, createdAt: last.createdAt }, scope)
        : null
  }
}
