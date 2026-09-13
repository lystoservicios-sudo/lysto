import { privateRoute } from '@/lib/http/route-handler'
import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import {
  adminPageQuery,
  changeAdminPermissions,
  listAdminWorkflow
} from '@/lib/admin/permissions-service'

export const GET = privateRoute({ permission: 'owner' }, async (request, session) =>
  privateJson(await listAdminWorkflow(session, 'permissions', adminPageQuery(request)))
)
export const PUT = privateRoute({ permission: 'owner' }, async (request, session) =>
  privateJson(await changeAdminPermissions(session, await readPrivateJsonBody(request)))
)
