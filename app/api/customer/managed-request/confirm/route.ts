import { z } from 'zod'
import { privateRoute } from '@/lib/http/route-handler'
import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { throwPricingDatabaseError } from '@/lib/pricing/server'

export const POST = privateRoute({ roles: ['customer'] }, async (request, session) => {
  const input = z.object({ id: z.string().uuid(), expectedVersion: z.number().int().positive(),
    assignmentVersion: z.number().int().positive(), scheduleVersion: z.number().int().positive()
  }).strict().parse(await readPrivateJsonBody(request))
  const { data, error } = await session.client.rpc('accept_admin_service_request', { p_id: input.id, p_expected_version: input.expectedVersion,
    p_assignment_version: input.assignmentVersion, p_schedule_version: input.scheduleVersion })
  if (error) throwPricingDatabaseError(error)
  return privateJson({ managedRequest: data })
})
