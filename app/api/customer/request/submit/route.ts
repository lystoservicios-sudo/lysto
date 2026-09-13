import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { z } from 'zod'
import { getPricingSession, pricingError, throwPricingDatabaseError } from '@/lib/pricing/server'
import { requireNewRequests } from '@/lib/release/runtime-switches'

export async function POST(request: Request) {
  try {
    const s = await getPricingSession()
    if (s.role !== 'customer' || !s.customerId) throw new Error('forbidden')
    const { quoteId, expectedVersion } = z
      .object({ quoteId: z.string().uuid(), expectedVersion: z.number().int().positive() })
      .strict()
      .parse(await readPrivateJsonBody(request))
    requireNewRequests()
    const { data, error } = await s.client.rpc('submit_service_quote_v2', {
      p_quote_id: quoteId,
      p_expected_version: expectedVersion
    })
    if (error) throwPricingDatabaseError(error)
    return privateJson({ accepted: true, result: data })
  } catch (error) {
    return pricingError(error)
  }
}
