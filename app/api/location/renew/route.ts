import { z } from 'zod'

import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { addressSelectionSchema } from '@/lib/location/contracts'
import { locationRoute } from '@/lib/location/http'
import { issueLocationProof, readAuthenticLocationProof } from '@/lib/location/proof'
import { resolveArgentineAddress } from '@/lib/location/resolve'
import { rememberResolvedAddress } from '@/lib/location/verified-points'

const renewalSchema = addressSelectionSchema.pick({ street: true, number: true, city: true, province: true }).extend({
  proof: z.string().min(40).max(4096)
}).strict()

export async function POST(request: Request) {
  return locationRoute(request, async () => {
    const { proof, ...expected } = renewalSchema.parse(await readPrivateJsonBody(request))
    const previous = readAuthenticLocationProof(proof, expected)
    const address = previous.source === 'manual' ? previous : await resolveArgentineAddress({
      ...expected, provinceId: previous.provinceId, cityId: previous.cityId, streetId: previous.streetId
    })
    if (address.source !== 'manual') await rememberResolvedAddress(address)
    return privateJson({ address, proof: issueLocationProof(address) })
  })
}
