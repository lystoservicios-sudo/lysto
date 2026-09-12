import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import type { UserRole } from '@/lib/domain/types'
import { ApiError } from '@/lib/http/api-error'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { readTrustedRole } from './session-routing'
import { assertAdminAssurance } from './admin-assurance'

const permissionSchema = z.enum(['operations', 'finance', 'quality', 'owner'])
export type AdminPermission = z.infer<typeof permissionSchema>
const contextSchema = z.object({
  profile_id: z.string().uuid(),
  role: z.enum(['customer', 'professional', 'admin']),
  customer_id: z.string().uuid().nullable(),
  professional_id: z.string().uuid().nullable(),
  professional_status: z.string().nullable(),
  admin_profile_id: z.string().uuid().nullable(),
  professional_eligible: z.boolean(),
  permissions: z.array(permissionSchema),
  session_id: z.string().uuid(),
  session_active: z.literal(true),
  aal: z.enum(['aal1', 'aal2'])
})

export type Session = {
  client: SupabaseClient<Database>
  userId: string
  profileId: string
  role: UserRole
  customerId?: string
  professionalId?: string
  professionalStatus?: string
  adminProfileId?: string
  permissions: AdminPermission[]
  sessionId: string
  assuranceLevel: 'aal1' | 'aal2'
}

/** Resolve fresh authority per operation. Never cache a session across requests. */
async function loadSession(forEnrollment = false): Promise<Session> {
  let client: SupabaseClient<Database>
  try {
    client = (await createServerSupabaseClient()) as unknown as SupabaseClient<Database>
  } catch {
    throw new ApiError('session_unavailable')
  }
  let identity: Awaited<ReturnType<typeof client.auth.getUser>>
  try {
    identity = await client.auth.getUser()
  } catch {
    throw new ApiError('session_unavailable')
  }
  const {
    data: { user },
    error
  } = identity
  if (error && (error.name === 'AuthRetryableFetchError' || (error.status ?? 0) >= 500))
    throw new ApiError('session_unavailable')
  if (error || !user) throw new ApiError('unauthorized')
  const trustedRole = readTrustedRole(user.app_metadata)
  if (!trustedRole) throw new ApiError('forbidden')
  const context = await client.rpc('get_session_context').then(
    (result) => result,
    () => {
      throw new ApiError('session_unavailable')
    }
  )
  if (context.error) throw new ApiError('session_unavailable')
  const parsed = contextSchema.safeParse(context.data)
  if (!parsed.success || parsed.data.role !== trustedRole) throw new ApiError('forbidden')
  const current = parsed.data
  if (current.role === 'customer' && !current.customer_id) throw new ApiError('forbidden')
  if (
    current.role === 'professional' &&
    (!current.professional_id ||
      (!forEnrollment &&
        (current.professional_status !== 'approved' || !current.professional_eligible)))
  )
    throw new ApiError('forbidden')
  if (current.role === 'admin' && (!current.admin_profile_id || current.permissions.length === 0))
    throw new ApiError('forbidden')
  if (!forEnrollment) assertAdminAssurance({ role: current.role, assuranceLevel: current.aal })
  return {
    client,
    userId: user.id,
    profileId: current.profile_id,
    role: current.role,
    customerId: current.customer_id ?? undefined,
    professionalId: current.professional_id ?? undefined,
    professionalStatus: current.professional_status ?? undefined,
    adminProfileId: current.admin_profile_id ?? undefined,
    permissions: current.permissions,
    sessionId: current.session_id,
    assuranceLevel: current.aal
  }
}

export async function requireSession(): Promise<Session> {
  return loadSession()
}
/** Own MFA enrollment/challenge only; never use this for domain operations. */
export async function requireSecuritySession(): Promise<Session> {
  return loadSession(true)
}

export async function requireRole(
  roles: UserRole | readonly UserRole[],
  session?: Session
): Promise<Session> {
  const current = session ?? (await requireSession())
  if (!(typeof roles === 'string' ? [roles] : roles).includes(current.role))
    throw new ApiError('forbidden')
  return current
}

export async function requireAdminPermission(
  permission: AdminPermission,
  session?: Session
): Promise<Session> {
  const current = await requireRole('admin', session)
  assertAdminAssurance(current)
  if (!current.permissions.includes('owner') && !current.permissions.includes(permission))
    throw new ApiError('forbidden')
  return current
}

/** Layout navigation complements authorization at each data/mutation boundary. */
export async function requirePageSession(role: UserRole): Promise<Session> {
  try {
    return await requireRole(role)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login')
    if (error instanceof ApiError && error.code === 'mfa_required') redirect('/seguridad')
    if (error instanceof ApiError && error.status === 403) notFound()
    throw error
  }
}
