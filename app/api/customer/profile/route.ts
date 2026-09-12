import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { privateJson } from '@/lib/http/api-error'
import { profileInputSchema } from '@/lib/customer-assets/contracts'
import { readCustomerProfile, writeCustomerAsset } from '@/lib/customer-assets/service'

export const GET = privateRoute({ roles: ['customer'] }, async (_request, session) =>
  privateJson({ profile: await readCustomerProfile(session) })
)
export const PUT = privateRoute({ roles: ['customer'] }, async (request, session) => {
  const { expectedVersion, ...data } = profileInputSchema.parse(await readPrivateJsonBody(request))
  return privateJson(await writeCustomerAsset(session, 'profile', data, null, expectedVersion))
})
