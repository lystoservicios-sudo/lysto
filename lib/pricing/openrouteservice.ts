import 'server-only'
import { z } from 'zod'
import { geocodeRoutingAddress } from '../location/routing-geocoding'
import type { TravelEstimate } from './service-quote'

const responseSchema = z.object({ routes: z.array(z.object({
  summary: z.object({ distance: z.number().finite().nonnegative(), duration: z.number().finite().nonnegative() }),
  way_points: z.array(z.number().int().nonnegative()),
  extras: z.object({ tollways: z.object({ values: z.array(z.tuple([z.number().int(), z.number().int(), z.number().int()])) }).optional() }).optional()
})) })

function verifiedTollFree(route: z.infer<typeof responseSchema>['routes'][number]) {
  const values = route.extras?.tollways?.values
  const lastPoint = route.way_points.at(-1)
  if (!values?.length || route.way_points[0] !== 0 || lastPoint === undefined || lastPoint <= 0) return false
  let covered = 0
  for (const [from, to, toll] of values) {
    if (from !== covered || to <= from || toll !== 0) return false
    covered = to
  }
  return covered === lastPoint
}

export async function estimateOpenRouteTravel({ address, origin, apiKey, departureTime, visitDurationMinutes = 120, now = new Date(), fetcher = fetch }: {
  address: string; origin: string; apiKey: string; departureTime?: string; visitDurationMinutes?: number; now?: Date; fetcher?: typeof fetch
}): Promise<TravelEstimate> {
  if (!Number.isInteger(visitDurationMinutes) || visitDurationMinutes < 30 || visitDurationMinutes > 480) throw new Error('invalid_visit_duration')
  if (!apiKey || !origin) throw new Error('routing_not_configured')
  const start = departureTime ? new Date(departureTime) : now
  if (!Number.isFinite(start.getTime()) || start.getTime() < now.getTime() - 60_000) throw new Error('invalid_departure_time')
  const [destination, departure] = await Promise.all([
    geocodeRoutingAddress(address, apiKey, fetcher), geocodeRoutingAddress(origin, apiKey, fetcher)
  ])
  if (departure.province !== 'CABA') throw new Error('origin_must_be_caba')
  async function drive(from: typeof departure, to: typeof destination) {
    const response = await fetcher('https://api.openrouteservice.org/v2/directions/driving-car/json', {
      method: 'POST', headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: [[from.longitude, from.latitude], [to.longitude, to.latitude]],
        options: { avoid_features: ['tollways', 'ferries'] }, extra_info: ['tollways'], instructions: false }),
      cache: 'no-store', signal: AbortSignal.timeout(10_000)
    })
    if (!response.ok) throw new Error(`ors_routing_http_${response.status}`)
    const route = responseSchema.parse(await response.json()).routes[0]
    if (!route) throw new Error('route_unavailable')
    const samePoint = from.longitude === to.longitude && from.latitude === to.latitude
    const confirmedNoTravel = samePoint && route.summary.distance === 0 && route.summary.duration === 0 &&
      !(route.extras?.tollways?.values ?? []).some(([, , toll]) => toll !== 0)
    const tollsVerified = confirmedNoTravel || verifiedTollFree(route)
    if (!tollsVerified) console.warn('ors_tolls_unverified', { distance: route.summary.distance,
      wayPoints: route.way_points, tollSegments: route.extras?.tollways?.values })
    return { km: route.summary.distance / 1000, minutes: route.summary.duration / 60, tollsVerified }
  }
  // ORS road durations are estimates, not traffic forecasts for the visit time.
  const [outbound, back] = await Promise.all([drive(departure, destination), drive(destination, departure)])
  return { source: 'openrouteservice', origin: departure.formattedAddress, destination: destination.formattedAddress,
    province: destination.province, outboundKm: outbound.km, returnKm: back.km, outboundMinutes: outbound.minutes,
    returnMinutes: back.minutes, tolls: 0, tollsVerified: outbound.tollsVerified && back.tollsVerified, measuredAt: now.toISOString() }
}
