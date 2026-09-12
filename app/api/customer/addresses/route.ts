import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { privateJson } from '@/lib/http/api-error'
import {
  addressInputSchema,
  addressUpdateSchema,
  archiveAssetSchema
} from '@/lib/customer-assets/contracts'
import {
  assetPageQuery,
  listCustomerAddresses,
  writeCustomerAsset
} from '@/lib/customer-assets/service'

export const GET = privateRoute({ roles: ['customer'] }, async (request, session) =>
  privateJson(await listCustomerAddresses(session, assetPageQuery(request)))
)
export const POST = privateRoute({ roles: ['customer'] }, async (request, session) =>
  privateJson(
    await writeCustomerAsset(
      session,
      'address',
      addressInputSchema.parse(await readPrivateJsonBody(request)),
      null,
      null
    ),
    { status: 201 }
  )
)
export const PUT = privateRoute({ roles: ['customer'] }, async (request, session) => {
  const { id, expectedVersion, ...data } = addressUpdateSchema.parse(
    await readPrivateJsonBody(request)
  )
  return privateJson(await writeCustomerAsset(session, 'address', data, id, expectedVersion))
})
export const DELETE = privateRoute({ roles: ['customer'] }, async (request, session) => {
  const { id, expectedVersion } = archiveAssetSchema.parse(await readPrivateJsonBody(request))
  return privateJson(await writeCustomerAsset(session, 'address', {}, id, expectedVersion, true))
})
