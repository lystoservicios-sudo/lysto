import { privateJson } from '@/lib/http/api-error'
import { privateRoute } from '@/lib/http/route-handler'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { enforceRateLimit, requestSubject } from '@/lib/security/rate-limit'
import { readCustomerPrivacy, requestCustomerAccountDeletion } from '@/lib/customer-account/service'
import { assertCustomerHomeRequestActor } from '@/lib/customer-homes/request-actor'

export const runtime = 'nodejs'
export const GET = privateRoute({ roles: ['customer'] }, async (_request, session) => privateJson(await readCustomerPrivacy(session)))
export const POST = privateRoute({ roles: ['customer'] }, async (request, session) => {
  assertCustomerHomeRequestActor(request, session)
  const input = await readPrivateJsonBody(request)
  await enforceRateLimit('auth', `${requestSubject(request)}:${session.userId}:customer-privacy`)
  return privateJson(await requestCustomerAccountDeletion(session, input))
})
