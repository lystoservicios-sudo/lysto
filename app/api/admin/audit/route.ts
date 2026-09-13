import { privateRoute } from '@/lib/http/route-handler'
import { privateJson } from '@/lib/http/api-error'
import { adminPageQuery, listAdminWorkflow } from '@/lib/admin/permissions-service'

export const GET = privateRoute({ roles: ['admin'] }, async (request, session) =>
  privateJson(await listAdminWorkflow(session, 'audit', adminPageQuery(request)))
)
