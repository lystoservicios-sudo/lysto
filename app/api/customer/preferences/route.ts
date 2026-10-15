import { privateJson } from '@/lib/http/api-error'
import { privateRoute } from '@/lib/http/route-handler'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { readCustomerPreferences, updateCustomerPreferences } from '@/lib/customer-account/service'
import { assertCustomerHomeRequestActor } from '@/lib/customer-homes/request-actor'

export const runtime = 'nodejs'
export const GET = privateRoute({ roles: ['customer'] }, async (_request, session) => privateJson(await readCustomerPreferences(session)))
export const PUT = privateRoute({ roles: ['customer'] }, async (request, session) => {
  assertCustomerHomeRequestActor(request, session)
  return privateJson(await updateCustomerPreferences(session, await readPrivateJsonBody(request)))
})
