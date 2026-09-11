import { z } from 'zod'
import { money, type TravelEstimate } from './service-quote.ts'

const geoSchema = z.object({ status: z.string(), results: z.array(z.object({
  partial_match: z.boolean().optional(), formatted_address: z.string(), geometry: z.object({ location: z.object({ lat: z.number().finite(), lng: z.number().finite() }) }),
  address_components: z.array(z.object({ long_name: z.string(), short_name: z.string(), types: z.array(z.string()) }))
})) })
const routeResponse = z.object({ routes: z.array(z.object({ distanceMeters: z.number().finite().nonnegative(), duration: z.string().regex(/^\d+(\.\d+)?s$/), travelAdvisory: z.object({ tollInfo: z.object({ estimatedPrice: z.array(z.object({ currencyCode: z.string(), units: z.string().optional(), nanos: z.number().optional() })).optional() }).optional() }).optional() })).default([]) })

export async function estimateTravel({ address, origin, apiKey, departureTime, now = new Date(), fetcher = fetch }: {
  address: string; origin: string; apiKey: string; departureTime?: string; now?: Date; fetcher?: typeof fetch
}): Promise<TravelEstimate> {
  if (!apiKey || !origin) throw new Error('routing_not_configured')
  async function geocode(text: string) {
    const params = new URLSearchParams({ address: text, components: 'country:AR', language: 'es', key: apiKey })
    const res = await fetcher(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, { signal: AbortSignal.timeout(10_000), cache: 'no-store' })
    if (!res.ok) throw new Error('geocoding_unavailable')
    const data = geoSchema.parse(await res.json())
    if (data.status !== 'OK' || data.results.length !== 1 || data.results[0].partial_match) throw new Error('address_ambiguous')
    const point = data.results[0]
    const component = (type: string) => point.address_components.find(c => c.types.includes(type))
    const state = component('administrative_area_level_1')?.long_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const province = state === 'ciudad autonoma de buenos aires' || state === 'caba' ? 'CABA' : state === 'provincia de buenos aires' || state === 'buenos aires' ? 'Buenos Aires' : 'other'
    if (component('country')?.short_name !== 'AR' || province === 'other') throw new Error('outside_coverage')
    return { ...point, province }
  }
  const destination = await geocode(address)
  const departure = await geocode(origin)
  if (departure.province !== 'CABA') throw new Error('origin_must_be_caba')
  const start = departureTime ? new Date(departureTime) : now
  if (!Number.isFinite(start.getTime()) || start.getTime() < now.getTime() - 60_000) throw new Error('invalid_departure_time')
  async function drive(from: typeof departure, to: typeof destination, date: Date) {
    const waypoint = (p: typeof departure) => ({ location: { latLng: { latitude: p.geometry.location.lat, longitude: p.geometry.location.lng } } })
    const res = await fetcher('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.travelAdvisory.tollInfo' },
      body: JSON.stringify({ origin: waypoint(from), destination: waypoint(to), travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE', departureTime: date.toISOString(), extraComputations: ['TOLLS'], languageCode: 'es-AR' }),
      signal: AbortSignal.timeout(10_000), cache: 'no-store'
    })
    if (!res.ok) throw new Error('route_unavailable')
    const first = routeResponse.parse(await res.json()).routes[0]
    if (!first) throw new Error('route_unavailable')
    const tollInfo = first.travelAdvisory?.tollInfo
    const prices = tollInfo?.estimatedPrice
    const tollsVerified = tollInfo === undefined || Boolean(prices?.length && prices.every(p => p.currencyCode === 'ARS'))
    return { km: first.distanceMeters / 1000, minutes: Number(first.duration.slice(0, -1)) / 60,
      tollsVerified, tolls: tollsVerified ? money((prices ?? []).reduce((sum, p) => sum + Number(p.units ?? 0) + (p.nanos ?? 0) / 1e9, 0)) : 0 }
  }
  const outbound = await drive(departure, destination, start)
  // Two hours is a planning assumption for the visit; the return is routed separately.
  const back = await drive(destination, departure, new Date(start.getTime() + (outbound.minutes + 120) * 60_000))
  return { source: 'google', origin: departure.formatted_address, destination: destination.formatted_address, province: destination.province as TravelEstimate['province'], outboundKm: outbound.km, returnKm: back.km, outboundMinutes: outbound.minutes, returnMinutes: back.minutes, tolls: money(outbound.tolls + back.tolls), tollsVerified: outbound.tollsVerified && back.tollsVerified, measuredAt: now.toISOString() }
}
