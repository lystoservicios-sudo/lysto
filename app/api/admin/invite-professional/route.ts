import { privateRoute } from '@/lib/http/route-handler'
import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import {
  createProfessionalInvitation,
  cancelProfessionalInvitation
} from '@/lib/professional/onboarding-service'

export const POST = privateRoute(
  { roles: ['admin'], permission: 'operations' },
  async (request, session) =>
    privateJson(await createProfessionalInvitation(session, await readPrivateJsonBody(request)), {
      status: 201
    })
)
export const PATCH = privateRoute(
  { roles: ['admin'], permission: 'operations' },
  async (request, session) =>
    privateJson(await cancelProfessionalInvitation(session, await readPrivateJsonBody(request)))
)
