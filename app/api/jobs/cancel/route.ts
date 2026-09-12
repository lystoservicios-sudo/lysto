import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { mutateJobException } from '@/lib/payments/financial-operations'

export const POST = privateRoute(
  { roles: ['admin'], permission: 'operations' },
  async (request, session) =>
    privateJson(await mutateJobException(session, await readPrivateJsonBody(request)))
)
