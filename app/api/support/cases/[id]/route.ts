import { ApiError, privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { updateSupportCase, replyCustomerSupportCase } from '@/lib/support/service'
import { readCustomerCase } from '@/lib/support/customer-center'
import { assertSupportRequestActor } from '@/lib/support/request-actor'

export const GET = privateRoute({ roles: ['customer'] }, async (request, session) => {
  assertSupportRequestActor(request, session)
  const id = new URL(request.url).pathname.split('/').filter(Boolean).at(-1) ?? ''
  const item = await readCustomerCase(session, id)
  if (!item) throw new ApiError('not_found')
  return privateJson({ case: item })
})

export const PATCH = privateRoute(
  { roles: ['customer', 'professional', 'admin'] },
  async (request, session) => {
    assertSupportRequestActor(request, session)
    const id = new URL(request.url).pathname.split('/').filter(Boolean).at(-1) ?? ''
    const body = await readPrivateJsonBody(request, 8192)
    return privateJson({
      case: session.role === 'customer' ? await replyCustomerSupportCase(session, id, body) : await updateSupportCase(session, id, body)
    })
  }
)
