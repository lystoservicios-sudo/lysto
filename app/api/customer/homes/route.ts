import { ApiError, privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { archiveHomeSchema, createHomeSchema, saveHomeSchema } from '@/lib/customer-homes/contracts'
import { readCustomerHomes, writeCustomerHome } from '@/lib/customer-homes/service'
import { assertCustomerHomeRequestActor } from '@/lib/customer-homes/request-actor'

export const GET = privateRoute({ roles: ['customer'] }, async (request, session) => {
  assertCustomerHomeRequestActor(request, session)
  if (new URL(request.url).search) throw new ApiError('invalid_input')
  return privateJson(await readCustomerHomes(session))
})
export const POST = privateRoute({ roles: ['customer'] }, async (request, session) => {
  assertCustomerHomeRequestActor(request, session)
  const input = createHomeSchema.parse(await readPrivateJsonBody(request, 524288))
  return privateJson(await writeCustomerHome(session, 'create', input), { status: 201 })
})
export const PUT = privateRoute({ roles: ['customer'] }, async (request, session) => {
  assertCustomerHomeRequestActor(request, session)
  const { id, expectedVersion, ...input } = saveHomeSchema.parse(await readPrivateJsonBody(request, 524288))
  return privateJson(await writeCustomerHome(session, 'save', input, id, expectedVersion))
})
export const DELETE = privateRoute({ roles: ['customer'] }, async (request, session) => {
  assertCustomerHomeRequestActor(request, session)
  const { id, expectedVersion } = archiveHomeSchema.parse(await readPrivateJsonBody(request))
  return privateJson(await writeCustomerHome(session, 'archive', {}, id, expectedVersion))
})
