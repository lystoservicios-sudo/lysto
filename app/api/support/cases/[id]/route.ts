import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { updateSupportCase } from '@/lib/support/service'

export const PATCH = privateRoute(
  { roles: ['customer', 'professional', 'admin'] },
  async (request, session) => {
    const id = new URL(request.url).pathname.split('/').filter(Boolean).at(-1) ?? ''
    return privateJson({
      case: await updateSupportCase(session, id, await readPrivateJsonBody(request, 8192))
    })
  }
)
