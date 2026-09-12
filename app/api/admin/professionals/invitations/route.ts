import { privateRoute } from '@/lib/http/route-handler'
import { privateJson } from '@/lib/http/api-error'
import { adminPageQuery } from '@/lib/admin/permissions-service'
import { listProfessionalWorkflow } from '@/lib/professional/admin-workflow'
export const GET = privateRoute({ permission: 'operations' }, async (request, session) =>
  privateJson(await listProfessionalWorkflow(session, 'invitations', adminPageQuery(request)))
)
