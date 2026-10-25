import { privateRoute } from '@/lib/http/route-handler'
import { privateJson } from '@/lib/http/api-error'
import { adminRequestOptions } from '@/lib/admin/service-request-service'

export const GET = privateRoute({ roles: ['admin'] }, async (request, session) =>
  privateJson(await adminRequestOptions(session, Object.fromEntries(new URL(request.url).searchParams)))
)
