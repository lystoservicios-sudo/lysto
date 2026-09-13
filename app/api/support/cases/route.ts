import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { listSupportCases, openSupportCase } from '@/lib/support/service'

export const GET = privateRoute(
  { roles: ['customer', 'professional', 'admin'] },
  async (request, session) => {
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? '50')
    return privateJson({ cases: await listSupportCases(session, limit) })
  }
)
export const POST = privateRoute(
  { roles: ['customer', 'professional', 'admin'] },
  async (request, session) =>
    privateJson({ case: await openSupportCase(session, await readPrivateJsonBody(request, 8192)) })
)
