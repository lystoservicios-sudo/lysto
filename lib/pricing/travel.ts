import 'server-only'
import { estimateTravel as estimateGoogleTravel } from './google-routes'
import { estimateOpenRouteTravel } from './openrouteservice'

export async function estimateTravel(input: Omit<Parameters<typeof estimateGoogleTravel>[0], 'apiKey'>) {
  const orsKey = process.env.OPENROUTESERVICE_API_KEY
  try {
    return orsKey ? await estimateOpenRouteTravel({ ...input, apiKey: orsKey })
      : await estimateGoogleTravel({ ...input, apiKey: process.env.GOOGLE_MAPS_SERVER_API_KEY ?? '' })
  } catch (error) {
    // Fixed diagnostic codes only: never log addresses, provider bodies or credentials.
    const message = error instanceof Error ? error.message : ''
    const safeCode = /^(ors_(geocoding|routing)_http_\d{3}|address_ambiguous|outside_coverage|origin_must_be_caba|routing_not_configured|route_unavailable)$/.test(message) ? message : 'routing_response_invalid'
    console.warn('travel_estimate_failed', { provider: orsKey ? 'openrouteservice' : 'google', code: safeCode })
    throw error
  }
}
