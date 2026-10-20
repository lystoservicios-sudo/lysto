import { afterEach, expect, it, vi } from 'vitest'
import { estimateOpenRouteTravel } from '@/lib/pricing/openrouteservice'
import { estimateTravel } from '@/lib/pricing/travel'
import { geocodeOpenRouteAddress } from '@/lib/location/openrouteservice'
vi.mock('@/lib/pricing/server', () => ({quoteWriter: () => ({rpc: async () => ({data:null,error:null})})}))

const now = new Date('2026-10-20T15:00:00Z')
const input = { address: 'Pavon 2012, CABA, Argentina', origin: 'Corrientes 1240, CABA, Argentina', apiKey: 'server-test-key', now }
const response = (body: unknown) => new Response(JSON.stringify(body))
function point(number = '2012', longitude = -58.4, region = 'Ciudad Autónoma de Buenos Aires') {
  return { geometry: { type: 'Point', coordinates: [longitude, -34.6] }, properties: {
    label: `Pavon ${number}, CABA, Argentina`, layer: 'address', housenumber: number, street: number === '1240' ? 'Corrientes' : 'Pavon', locality: 'Buenos Aires',
    country_a: 'ARG', region, confidence: 1, accuracy: 'point', match_type: 'exact'
  } }
}
const route = (distance = 10000, duration = 1800, value = 0) => ({ routes: [{
  summary: { distance, duration }, way_points: [0, 100],
  extras: { tollways: { values: [[0, 100, value]], summary: [{ value, distance, amount: 100 }] } }
}] })
function fetchRoutes() {
  return vi.fn().mockResolvedValueOnce(response({ features: [point()] }))
    .mockResolvedValueOnce(response({ features: [point('1240', -58.5)] }))
    .mockResolvedValueOnce(response(route())).mockResolvedValueOnce(response(route(12000, 2400)))
}
afterEach(() => vi.unstubAllEnvs())
it('rejects a different street even when the house number and confidence match', async () => {
  const candidate = point('5871', -58.323826, 'Buenos Aires')
  candidate.properties.street = 'Coronel Brandsen'
  candidate.properties.locality = 'Wilde'
  await expect(geocodeOpenRouteAddress('Calle 23 5871, Berazategui, Buenos Aires, Argentina', 'key',
    vi.fn().mockResolvedValue(response({features:[candidate]})))).rejects.toThrow('address_ambiguous')
})
it('rejects the same street and house number in a different locality', async () => {
  const candidate = point('5871', -58.323826, 'Buenos Aires')
  candidate.properties.street = '23'
  candidate.properties.locality = 'La Plata'
  await expect(geocodeOpenRouteAddress('Calle 23 5871, Berazategui, Buenos Aires, Argentina', 'key',
    vi.fn().mockResolvedValue(response({features:[candidate]})))).rejects.toThrow('address_ambiguous')
})
it('accepts the exact numbered street and house within its verified municipality', async () => {
  const candidate = point('5871', -58.2, 'Buenos Aires')
  candidate.properties.street = '23'
  candidate.properties.locality = 'Berazategui'
  await expect(geocodeOpenRouteAddress('CALLE 23 5871, Berazategui Oeste, Buenos Aires, Argentina', 'key',
    vi.fn().mockResolvedValue(response({features:[candidate]})))).resolves.toMatchObject({province:'Buenos Aires'})
})
it('accepts provider-confirmed zero travel only when both verified points coincide', async () => {
  const zeroRoute = { routes: [{ summary: { distance: 0, duration: 0 }, way_points: [0, 0] }] }
  const fetcher = vi.fn().mockResolvedValueOnce(response({ features: [point()] }))
    .mockResolvedValueOnce(response({ features: [point()] })).mockImplementation(async () => response(zeroRoute))
  const result = await estimateOpenRouteTravel({ ...input, origin: input.address, fetcher })
  expect(result).toMatchObject({ outboundKm: 0, returnKm: 0, tolls: 0, tollsVerified: true })
})
it('prices separate outward and return journeys and verifies toll-free coverage', async () => {
  const fetcher = fetchRoutes()
  const result = await estimateOpenRouteTravel({ ...input, fetcher })
  expect(result).toMatchObject({ source: 'openrouteservice', outboundKm: 10, returnKm: 12, outboundMinutes: 30, returnMinutes: 40, tolls: 0, tollsVerified: true })
  for (const [url, options] of fetcher.mock.calls) {
    expect(url).not.toContain(input.apiKey)
    expect(options.headers.Authorization).toBe(input.apiKey)
  }
  const outward = JSON.parse(fetcher.mock.calls[2][1].body)
  const back = JSON.parse(fetcher.mock.calls[3][1].body)
  expect(outward.options.avoid_features).toContain('tollways')
  expect(outward.extra_info).toContain('tollways')
  expect(outward.coordinates).toEqual([...back.coordinates].reverse())
})
it.each(['missing', 'charged', 'partial'])('does not certify zero tolls when evidence is %s', async kind => {
  const body = route()
  if (kind === 'missing') delete (body.routes[0] as { extras?: unknown }).extras
  else body.routes[0].extras.tollways.values = kind === 'charged' ? [[0, 100, 1]] : [[0, 50, 0]]
  const fetcher = vi.fn().mockResolvedValueOnce(response({ features: [point()] }))
    .mockResolvedValueOnce(response({ features: [point('1240')] })).mockImplementation(async () => response(body))
  expect((await estimateOpenRouteTravel({ ...input, fetcher })).tollsVerified).toBe(false)
})
it.each(['wrong-number', 'street-only', 'ambiguous', 'low-confidence'])('rejects an unreliable geocode (%s)', async kind => {
  const candidate = point(kind === 'wrong-number' ? '2014' : '2012')
  if (kind === 'street-only') candidate.properties.layer = 'street'
  if (kind === 'low-confidence') candidate.properties.confidence = 0.4
  const features = kind === 'ambiguous' ? [candidate, point('2012', -58.8)] : [candidate]
  await expect(geocodeOpenRouteAddress(input.address, input.apiKey, vi.fn().mockResolvedValue(response({ features })))).rejects.toThrow('address_ambiguous')
})
it('rejects an address outside the service area', async () => {
  await expect(geocodeOpenRouteAddress(input.address, input.apiKey, vi.fn().mockResolvedValue(response({ features: [point('2012', -58.4, 'Córdoba')] })))).rejects.toThrow('outside_coverage')
})
it('fails closed on unavailable routes or rejected credentials', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 403 }))
  await expect(estimateOpenRouteTravel({ ...input, fetcher })).rejects.toThrow('ors_geocoding_http_403')
  await expect(estimateOpenRouteTravel({ ...input, apiKey: '', fetcher })).rejects.toThrow('routing_not_configured')
})
it.each([0, 29, 481, 31.5])('rejects invalid duration %s before calling the provider', async visitDurationMinutes => {
  const fetcher = vi.fn()
  await expect(estimateOpenRouteTravel({ ...input, visitDurationMinutes, fetcher })).rejects.toThrow('invalid_visit_duration')
  expect(fetcher).not.toHaveBeenCalled()
})
it('selects the configured OpenRouteService provider without needing a Google key', async () => {
  vi.stubEnv('OPENROUTESERVICE_API_KEY', input.apiKey)
  vi.stubEnv('GOOGLE_MAPS_SERVER_API_KEY', '')
  expect((await estimateTravel({ address: input.address, origin: input.origin, now, fetcher: fetchRoutes() })).source).toBe('openrouteservice')
})
