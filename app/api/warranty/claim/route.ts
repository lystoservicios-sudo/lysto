import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { openWarrantyClaim } from '@/lib/support/service'

export const POST = privateRoute({ roles: ['customer'] }, async (request, session) =>
  privateJson({ claim: await openWarrantyClaim(session, await readPrivateJsonBody(request, 8192)) })
)
