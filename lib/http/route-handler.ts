import { requireAdminPermission, requireRole, requireSession, type AdminPermission, type Session } from '@/lib/auth/session'
import type { UserRole } from '@/lib/domain/types'
import { ApiError, apiErrorResponse, privateResponse } from './api-error'

export type RouteAccess = { roles?: readonly UserRole[]; permission?: AdminPermission }

export function privateRoute(access: RouteAccess, handler: (request: Request, session: Session) => Promise<Response>) {
  return async (request: Request) => {
    try {
      const session = await requireSession()
      if (access.roles) await requireRole(access.roles, session)
      if (access.permission) await requireAdminPermission(access.permission, session)
      return privateResponse(await handler(request, session))
    } catch (error) { return apiErrorResponse(error) }
  }
}

/** Fail closed until the transactional implementation is available. */
export function unavailableRoute(access: RouteAccess) {
  return privateRoute(access, async () => { throw new ApiError('feature_unavailable') })
}
