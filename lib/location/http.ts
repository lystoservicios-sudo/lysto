import 'server-only'

import { ZodError } from 'zod'
import { requireSecuritySession } from '@/lib/auth/session'
import { ApiError, apiErrorResponse } from '@/lib/http/api-error'
import { enforceRateLimit, RateLimitExceeded, rateLimitResponse, requestSubject } from '@/lib/security/rate-limit'

export async function locationRoute(request: Request, handler: () => Promise<Response>) {
  try {
    const session = await requireSecuritySession()
    if (!['customer', 'professional'].includes(session.role)) throw new ApiError('forbidden')
    await enforceRateLimit('location', `${session.profileId}:${requestSubject(request)}`)
    return await handler()
  } catch (error) {
    if (error instanceof RateLimitExceeded) return rateLimitResponse(error)
    if (error instanceof ApiError || error instanceof ZodError || error instanceof SyntaxError) return apiErrorResponse(error)
    return apiErrorResponse(new ApiError('service_unavailable'))
  }
}

