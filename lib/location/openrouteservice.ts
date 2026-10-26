import 'server-only'
import { z } from 'zod'
import { findArgentineProvince } from './provinces'

const optionalProviderText = z.unknown().transform(value => typeof value === 'string' ? value : undefined).optional()
const responseSchema = z.object({ features: z.array(z.object({
  geometry: z.object({ type: z.literal('Point'), coordinates: z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]) }),
  properties: z.object({ label: z.string(), layer: z.string(), housenumber: z.string().optional(),
    street: optionalProviderText, locality: optionalProviderText, localadmin: optionalProviderText, county: optionalProviderText,
    country_a: z.string(), region: z.string().optional(), region_a: z.string().optional(),
    confidence: z.number().optional(), accuracy: z.string().optional(), match_type: z.string().optional() })
})) })
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const streetName = (text: string) => normalize(text).replace(/^(avenida|av|calle) /, '')
const municipality = (text: string) => normalize(text) === 'berazategui oeste' ? 'berazategui' : normalize(text)
type StructuredAddress = { street: string; number: string; city?: string; province?: string }

async function geocodeAddress(address: string, apiKey: string, fetcher: typeof fetch,
  structured: StructuredAddress | undefined, national: boolean) {
  if (!apiKey) throw new Error('geocoding_not_configured')
  // The house number is the final numeric token in the street portion (e.g. Calle 23 5871).
  const number = address.split(',')[0].match(/\d+\s*$/)?.[0].trim()
  const parts = address.split(',').map(normalize).filter(part => part && part !== 'argentina')
  const expectedStreet = streetName(address.split(',')[0].replace(/\s+\d+\s*$/, ''))
  const expectedProvince = findArgentineProvince(structured?.province) ?? parts.slice(1).map(findArgentineProvince).filter(Boolean).at(-1)
  const expectedCity = structured?.city ? municipality(structured.city)
    : parts[1] && (parts.length > 2 || !findArgentineProvince(parts[1])) ? municipality(parts[1]) : null
  const query = address.replace(/\bCABA\b/gi, 'Ciudad Autónoma de Buenos Aires')
  const params = structured ? new URLSearchParams({ address: `${structured.number} ${structured.street}`, country: 'ARG',
    ...(structured.city ? { locality: structured.city } : {}), ...(structured.province ? { region: structured.province } : {}) })
    : new URLSearchParams({ text: query, 'boundary.country': 'ARG', layers: 'address', size: '5' })
  const response = await fetcher(`https://api.openrouteservice.org/geocode/search${structured ? '/structured' : ''}?${params}`, {
    headers: { Authorization: apiKey }, cache: 'no-store', signal: AbortSignal.timeout(8_000)
  })
  if (!response.ok) throw new Error(`ors_geocoding_http_${response.status}`)
  const data = responseSchema.parse(await response.json())
  const candidates = data.features.filter(({ properties: p }) => p.layer === 'address' && number && p.housenumber === number &&
    p.street && streetName(p.street) === expectedStreet &&
    (expectedProvince?.id === '02' || !expectedCity || [p.locality, p.localadmin, p.county].some(value => value && municipality(value) === expectedCity)) &&
    (p.confidence ?? 0) >= 0.8 && p.match_type !== 'fallback' && ['point', 'interpolated'].includes(p.accuracy ?? ''))
  // Duplicate records at the same coordinate can come from different source datasets.
  const unique = [...new Map(candidates.map(p => [p.geometry.coordinates.join(','), p])).values()]
  if (unique.length !== 1) {
    console.warn('ors_geocode_unresolved', { hasHouseNumber: Boolean(number), matches: unique.length,
      candidates: data.features.map(({ properties: p }) => ({ layer: p.layer, accuracy: p.accuracy,
        confidence: p.confidence, match: p.match_type, numberMatches: p.housenumber === number,
        streetMatches: Boolean(p.street && streetName(p.street) === expectedStreet), region: p.region })) })
    throw new Error('address_ambiguous')
  }
  const selected = unique[0], p = selected.properties
  const province = findArgentineProvince(p.region) ?? findArgentineProvince(
    normalize(p.region ?? '') === 'autonomous city of buenos aires' || p.region_a === 'C' ? '02' : p.region_a === 'B' ? '06' : undefined)
  if (p.country_a !== 'ARG' || !province || (!national && !['02', '06'].includes(province.id))) throw new Error('outside_coverage')
  if (expectedProvince && province.id !== expectedProvince.id) throw new Error('address_ambiguous')
  return { formattedAddress: p.label, longitude: selected.geometry.coordinates[0], latitude: selected.geometry.coordinates[1],
    province: province.name, precision: p.accuracy === 'interpolated' ? 'range_interpolated' as const : 'rooftop' as const }
}

/** Existing routing callers remain restricted to the commercial service area. */
export async function geocodeOpenRouteAddress(address: string, apiKey: string, fetcher: typeof fetch = fetch, structured?: StructuredAddress):
  Promise<Awaited<ReturnType<typeof geocodeAddress>> & { province: 'CABA' | 'Buenos Aires' }> {
  const point = await geocodeAddress(address, apiKey, fetcher, structured, false)
  const province = point.province
  if (province !== 'CABA' && province !== 'Buenos Aires') throw new Error('outside_coverage')
  return { ...point, province }
}

/** Registration accepts precise Argentine domiciles without expanding routing coverage. */
export function geocodeArgentineOpenRouteAddress(address: string, apiKey: string, fetcher: typeof fetch = fetch, structured?: StructuredAddress) {
  return geocodeAddress(address, apiKey, fetcher, structured, true)
}
