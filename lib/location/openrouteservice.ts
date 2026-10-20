import 'server-only'
import { z } from 'zod'

const responseSchema = z.object({ features: z.array(z.object({
  geometry: z.object({ type: z.literal('Point'), coordinates: z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]) }),
  properties: z.object({ label: z.string(), layer: z.string(), housenumber: z.string().optional(),
    country_a: z.string(), region: z.string().optional(), region_a: z.string().optional(),
    confidence: z.number().optional(), accuracy: z.string().optional(), match_type: z.string().optional() })
})) })
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Geocodes an address, never a city/street centroid, for server-side routing. */
export async function geocodeOpenRouteAddress(address: string, apiKey: string, fetcher: typeof fetch = fetch) {
  if (!apiKey) throw new Error('geocoding_not_configured')
  // The house number is the final numeric token in the street portion (e.g. Calle 23 5871).
  const number = address.split(',')[0].match(/\d+\s*$/)?.[0].trim()
  const query = address.replace(/\bCABA\b/gi, 'Ciudad Autónoma de Buenos Aires')
  const params = new URLSearchParams({ text: query, 'boundary.country': 'ARG', layers: 'address', size: '5' })
  const response = await fetcher(`https://api.openrouteservice.org/geocode/search?${params}`, {
    headers: { Authorization: apiKey }, cache: 'no-store', signal: AbortSignal.timeout(8_000)
  })
  if (!response.ok) throw new Error(`ors_geocoding_http_${response.status}`)
  const data = responseSchema.parse(await response.json())
  const candidates = data.features.filter(({ properties: p }) => p.layer === 'address' && number && p.housenumber === number &&
    (p.confidence ?? 0) >= 0.8 && p.match_type !== 'fallback' && ['point', 'interpolated'].includes(p.accuracy ?? ''))
  // Duplicate records at the same coordinate can come from different source datasets.
  const unique = [...new Map(candidates.map(p => [p.geometry.coordinates.join(','), p])).values()]
  if (unique.length !== 1) throw new Error('address_ambiguous')
  const selected = unique[0], p = selected.properties
  const region = normalize(p.region ?? '')
  const province: 'CABA' | 'Buenos Aires' | 'other' = ['ciudad autonoma de buenos aires', 'capital federal', 'autonomous city of buenos aires'].includes(region) || p.region_a === 'C' ? 'CABA'
    : ['buenos aires', 'provincia de buenos aires'].includes(region) || p.region_a === 'B' ? 'Buenos Aires' : 'other'
  if (p.country_a !== 'ARG' || province === 'other') throw new Error('outside_coverage')
  return { formattedAddress: p.label, longitude: selected.geometry.coordinates[0], latitude: selected.geometry.coordinates[1],
    province, precision: p.accuracy === 'interpolated' ? 'range_interpolated' as const : 'rooftop' as const }
}
