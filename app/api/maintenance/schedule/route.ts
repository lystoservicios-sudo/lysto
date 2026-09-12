import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { listMaintenance, manageMaintenance } from '@/lib/equipment/maintenance-service'

export const GET = privateRoute({ roles: ['customer'] }, async (_request, session) =>
  privateJson({ maintenance: await listMaintenance(session) })
)
export const POST = privateRoute({ roles: ['customer'] }, async (request, session) =>
  privateJson({ plan: await manageMaintenance(session, await readPrivateJsonBody(request, 8192)) })
)
