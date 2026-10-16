import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { addressSelectionSchema } from '@/lib/location/contracts'
import { locationRoute } from '@/lib/location/http'
import { issueLocationProof } from '@/lib/location/proof'
import { resolveArgentineAddress } from '@/lib/location/resolve'

export async function POST(request: Request) {
  return locationRoute(request, async () => {
    const input = addressSelectionSchema.parse(await readPrivateJsonBody(request))
    const address = await resolveArgentineAddress(input)
    return privateJson({ address, proof: issueLocationProof(address) })
  })
}

