import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { addHomeEquipmentSchema } from '@/lib/customer-homes/contracts'
import { writeCustomerHome } from '@/lib/customer-homes/service'

export const POST = privateRoute({ roles: ['customer'] }, async (request, session) => {
  const { homeId, expectedVersion, ...input } = addHomeEquipmentSchema.parse(await readPrivateJsonBody(request))
  return privateJson(await writeCustomerHome(session, 'equipment', input, homeId, expectedVersion), { status: 201 })
})
