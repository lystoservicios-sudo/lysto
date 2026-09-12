import { apiErrorResponse, privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { invitationAuthentication } from '@/lib/professional/invitation-auth'
export async function POST(request: Request) {
  try {
    return privateJson(await invitationAuthentication(await readPrivateJsonBody(request), false))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
