import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import {
  getScheduleAvailability,
  replaceProfessionalScheduleSettings,
  scheduleAvailabilityQuery
} from '@/lib/scheduling/service'

export const GET = privateRoute({ roles: ['professional', 'admin'] }, async (request, session) =>
  privateJson(await getScheduleAvailability(session, scheduleAvailabilityQuery(request)))
)
export const PUT = privateRoute({ roles: ['professional', 'admin'] }, async (request, session) =>
  privateJson(
    await replaceProfessionalScheduleSettings(session, await readPrivateJsonBody(request, 32768))
  )
)
