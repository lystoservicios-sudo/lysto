import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { privateJson } from '@/lib/http/api-error'
import { archiveAssetSchema } from '@/lib/customer-assets/contracts'
import {
  assetPageQuery,
  listCustomerEquipment,
  writeCustomerAsset
} from '@/lib/customer-assets/service'

export const GET = privateRoute({ roles: ['customer'] }, async (request, session) =>
  privateJson(await listCustomerEquipment(session, assetPageQuery(request)))
)
export const DELETE = privateRoute({ roles: ['customer'] }, async (request, session) => {
  const { id, expectedVersion } = archiveAssetSchema.parse(await readPrivateJsonBody(request))
  return privateJson(await writeCustomerAsset(session, 'equipment', {}, id, expectedVersion, true))
})
