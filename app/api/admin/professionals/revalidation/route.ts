import { privateRoute } from '@/lib/http/route-handler'
import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { requestProfessionalRevalidation } from '@/lib/professional/onboarding-service'

export const POST = privateRoute({ roles: ['admin'], permission: 'operations' }, async (request, session) =>
  privateJson(await requestProfessionalRevalidation(session, await readPrivateJsonBody(request))))
