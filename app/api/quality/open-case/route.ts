import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { openSupportCase } from '@/lib/support/service'

export const POST = privateRoute(
  { roles: ['admin'], permission: 'quality' },
  async (request, session) =>
    privateJson({ case: await openSupportCase(session, await readPrivateJsonBody(request, 8192)) })
)
