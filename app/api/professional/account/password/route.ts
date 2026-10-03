import { apiErrorResponse, privateJson } from '@/lib/http/api-error'
import { ApiError } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { checkAccountOrigin } from '@/lib/auth/account-response'
import { onboardingIdentity } from '@/lib/professional/onboarding-service'
import { changeProfessionalPassword } from '@/lib/professional/account-security'
import { enforceRateLimit, rateLimitResponse, RateLimitExceeded, requestSubject } from '@/lib/security/rate-limit'

export async function POST(request: Request) {
  if (!checkAccountOrigin(request)) return privateJson({ error: 'Origen no permitido.' }, { status: 403 })
  try {
    const client = await onboardingIdentity()
    const { data, error } = await client.auth.getUser()
    if (error || !data.user) throw new ApiError('unauthorized')
    await enforceRateLimit('auth', `${requestSubject(request)}:${data.user.id}:password-change`)
    return privateJson(await changeProfessionalPassword(client, await readPrivateJsonBody(request)))
  } catch (error) {
    if (error instanceof RateLimitExceeded) return rateLimitResponse(error)
    return apiErrorResponse(error)
  }
}
