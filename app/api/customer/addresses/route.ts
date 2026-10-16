import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { ApiError, privateJson } from '@/lib/http/api-error'
import {
  addressMutationInputSchema,
  addressMutationUpdateSchema,
  archiveAssetSchema
} from '@/lib/customer-assets/contracts'
import {
  assetPageQuery,
  listCustomerAddresses,
  readCustomerAddressLocation,
  writeCustomerAsset
} from '@/lib/customer-assets/service'
import { canonicalizeAddressMutation } from '@/lib/location/mutation'

function canonical(input: Parameters<typeof canonicalizeAddressMutation>[0], existing: Parameters<typeof canonicalizeAddressMutation>[1]) {
  try { return canonicalizeAddressMutation(input, existing) }
  catch { throw new ApiError('invalid_input') }
}

export const GET = privateRoute({ roles: ['customer'] }, async (request, session) =>
  privateJson(await listCustomerAddresses(session, assetPageQuery(request)))
)
export const POST = privateRoute({ roles: ['customer'] }, async (request, session) =>
  privateJson(
    await writeCustomerAsset(
      session,
      'address',
      canonical(addressMutationInputSchema.parse(await readPrivateJsonBody(request)), null),
      null,
      null
    ),
    { status: 201 }
  )
)
export const PUT = privateRoute({ roles: ['customer'] }, async (request, session) => {
  const { id, expectedVersion, ...data } = addressMutationUpdateSchema.parse(
    await readPrivateJsonBody(request)
  )
  const existing = await readCustomerAddressLocation(session, id)
  return privateJson(await writeCustomerAsset(session, 'address', canonical(data, existing), id, expectedVersion))
})
export const DELETE = privateRoute({ roles: ['customer'] }, async (request, session) => {
  const { id, expectedVersion } = archiveAssetSchema.parse(await readPrivateJsonBody(request))
  return privateJson(await writeCustomerAsset(session, 'address', {}, id, expectedVersion, true))
})
