import { privateRoute } from '@/lib/http/route-handler'
import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { readAdminRequests, saveAdminRequest } from '@/lib/admin/service-request-service'
import { z } from 'zod'

export const GET = privateRoute({ roles: ['admin'] }, async (request, session) => {
  const parameters = z.object({ id: z.string().uuid().optional(), cursor: z.string().optional() }).strict()
    .refine(value => !(value.id && value.cursor)).parse(Object.fromEntries(new URL(request.url).searchParams))
  return privateJson(await readAdminRequests(session, parameters.id, { cursor: parameters.cursor }))
})
export const POST = privateRoute({ roles: ['admin'] }, async (request, session) =>
  privateJson({ record: await saveAdminRequest(session, await readPrivateJsonBody(request)) })
)
