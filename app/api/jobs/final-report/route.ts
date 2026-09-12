import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { closeJob } from '@/lib/jobs/closeout-service'

export const POST = privateRoute({ roles: ['professional'] }, async (request, session) =>
  privateJson({ report: await closeJob(session, await readPrivateJsonBody(request, 32768)) })
)
