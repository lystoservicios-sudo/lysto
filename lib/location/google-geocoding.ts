import 'server-only'
import { z } from 'zod'

const googleResponse = z.object({
  status: z.string(),
  results: z.array(z.object({
    partial_match: z.boolean().optional(), formatted_address: z.string(),
    geometry: z.object({ location: z.object({ lat: z.number().finite(), lng: z.number().finite() }), location_type: z.enum(['ROOFTOP', 'RANGE_INTERPOLATED', 'GEOMETRIC_CENTER', 'APPROXIMATE']) }),
    address_components: z.array(z.object({ long_name: z.string(), short_name: z.string(), types: z.array(z.string()) }))
  }))
})

export async function geocodeVerifiedAddress(address: string, apiKey: string, fetcher: typeof fetch = fetch) {
  if (!apiKey) throw new Error('geocoding_not_configured')
  const params = new URLSearchParams({ address, components: 'country:AR', language: 'es', key: apiKey })
  const response = await fetcher(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error('geocoding_unavailable')
  const data = googleResponse.parse(await response.json())
  if (data.status !== 'OK') throw new Error('address_unresolved')
  const candidates = data.results.filter((item) => !item.partial_match && item.geometry.location_type !== 'APPROXIMATE')
  if (candidates.length !== 1) throw new Error('address_ambiguous')
  const selected = candidates[0]
  const component = (type: string) => selected.address_components.find((item) => item.types.includes(type))
  const province = component('administrative_area_level_1')?.long_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (component('country')?.short_name !== 'AR' || !['ciudad autonoma de buenos aires', 'caba', 'provincia de buenos aires', 'buenos aires'].includes(province ?? '')) throw new Error('outside_coverage')
  return {
    formattedAddress: selected.formatted_address,
    latitude: selected.geometry.location.lat,
    longitude: selected.geometry.location.lng,
    precision: selected.geometry.location_type.toLowerCase() as 'rooftop' | 'range_interpolated' | 'geometric_center'
  }
}

