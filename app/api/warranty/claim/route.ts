import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { openWarrantyClaim } from '@/lib/support/service'
import { assertSupportRequestActor } from '@/lib/support/request-actor'

export const POST = privateRoute({ roles: ['customer'] }, async (request, session) => {
  assertSupportRequestActor(request, session)
  return privateJson({ claim: await openWarrantyClaim(session, await readPrivateJsonBody(request, 8192)) })
})
