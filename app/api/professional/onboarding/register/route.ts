import { apiErrorResponse, privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { invitationAuthentication } from '@/lib/professional/invitation-auth'
import { enforceRateLimit, rateLimitResponse, RateLimitExceeded, requestSubject } from '@/lib/security/rate-limit'
export async function POST(request: Request) {
  try {
    await enforceRateLimit('registration', `${requestSubject(request)}:professional-invitation`)
    return privateJson(await invitationAuthentication(await readPrivateJsonBody(request), true))
  } catch (error) {
    if (error instanceof RateLimitExceeded) return rateLimitResponse(error)
    return apiErrorResponse(error)
  }
}
