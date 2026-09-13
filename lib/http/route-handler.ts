import {
  requireAdminPermission,
  requireRole,
  requireSession,
  type AdminPermission,
  type Session
} from '@/lib/auth/session'
import type { UserRole } from '@/lib/domain/types'
import { ApiError, apiErrorResponse, privateResponse } from './api-error'
import {
  enforceRateLimit,
  RateLimitExceeded,
  rateLimitResponse,
  requestSubject
} from '@/lib/security/rate-limit'
import { logEvent } from '@/lib/observability/logger'

export type RouteAccess = { roles?: readonly UserRole[]; permission?: AdminPermission }

export function privateRoute(
  access: RouteAccess,
  handler: (request: Request, session: Session) => Promise<Response>
) {
  return async (request: Request) => {
    const started = Date.now(),
      correlationId = request.headers.get('x-correlation-id') ?? 'missing',
      route = new URL(request.url).pathname
    try {
      const session = await requireSession()
      if (access.roles) await requireRole(access.roles, session)
      if (access.permission) await requireAdminPermission(access.permission, session)
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method))
        await enforceRateLimit(
          'private_mutation',
          `${session.profileId}:${requestSubject(request)}`
        )
      const response = privateResponse(await handler(request, session))
      logEvent('info', 'http.request', {
        correlationId,
        route,
        method: request.method,
        status: response.status,
        latencyMs: Date.now() - started
      })
      return response
    } catch (error) {
      const response =
        error instanceof RateLimitExceeded ? rateLimitResponse(error) : apiErrorResponse(error)
      logEvent(response.status >= 500 ? 'error' : 'warn', 'http.request', {
        correlationId,
        route,
        method: request.method,
        status: response.status,
        latencyMs: Date.now() - started,
        errorCode:
          error instanceof ApiError
            ? error.code
            : error instanceof RateLimitExceeded
              ? 'rate_limited'
              : 'unexpected'
      })
      return response
    }
  }
}

/** Fail closed until the transactional implementation is available. */
export function unavailableRoute(access: RouteAccess) {
  return privateRoute(access, async () => {
    throw new ApiError('feature_unavailable')
  })
}
