import { ApiError, privateJson } from '@/lib/http/api-error'
import { privateRoute } from '@/lib/http/route-handler'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { assertCustomerHomeRequestActor } from '@/lib/customer-homes/request-actor'
import { isAllowedAuthOrigin } from '@/lib/auth/account-lifecycle'
import { customerRequestService } from '@/lib/customer-requests/service'
import { requireNewRequests } from '@/lib/release/runtime-switches'

export const runtime = 'nodejs'
export const POST = privateRoute({ roles: ['customer'] }, async (request, session) => {
  assertCustomerHomeRequestActor(request, session)
  if (!isAllowedAuthOrigin(request.headers.get('origin'), process.env.NEXT_PUBLIC_APP_URL)) throw new ApiError('forbidden')
  requireNewRequests()
  return privateJson(await customerRequestService.preview(session, await readPrivateJsonBody(request, 32768)))
})
