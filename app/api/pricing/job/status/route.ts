import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { mutateOnsite } from '@/lib/jobs/onsite-service'
export const POST = privateRoute(
  { roles: ['professional', 'customer'] },
  async (request, session) =>
    privateJson({ result: await mutateOnsite(session, await readPrivateJsonBody(request)) })
)
