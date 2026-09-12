import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import {
  requestJobReschedule,
  respondJobReschedule,
  rescheduleActionSchema
} from '@/lib/scheduling/service'

export const POST = privateRoute(
  { roles: ['customer', 'professional', 'admin'] },
  async (request, session) => {
    const input = rescheduleActionSchema.parse(await readPrivateJsonBody(request))
    const { action, ...payload } = input
    return privateJson(
      action === 'request'
        ? await requestJobReschedule(session, payload)
        : await respondJobReschedule(session, payload)
    )
  }
)
