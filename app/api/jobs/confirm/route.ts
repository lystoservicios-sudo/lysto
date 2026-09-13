import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { confirmJobOutcome } from '@/lib/jobs/customer-confirmation'

export const POST = privateRoute({ roles: ['customer'] }, async (request, session) =>
  privateJson({
    decision: await confirmJobOutcome(session, await readPrivateJsonBody(request, 8192))
  })
)
