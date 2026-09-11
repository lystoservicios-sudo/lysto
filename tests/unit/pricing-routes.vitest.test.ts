import { expect, it, vi } from 'vitest'
import { estimateTravel } from '@/lib/pricing/google-routes'
const now = new Date('2026-09-10T15:00:00Z')
const geocode = (state = 'Ciudad Autónoma de Buenos Aires', country = 'AR') => ({ status: 'OK', results: [{ formatted_address: 'Corrientes 1240, CABA', geometry: { location: { lat: -34.6, lng: -58.4 } }, address_components: [{ long_name: state, short_name: state, types: ['administrative_area_level_1'] }, { long_name: 'Argentina', short_name: country, types: ['country'] }] }] })
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
it('obtains geocoded jurisdiction and two actual drive routes', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response(geocode())).mockResolvedValueOnce(response(geocode()))
    .mockResolvedValueOnce(response({ routes: [{ distanceMeters: 10000, duration: '1800s', travelAdvisory: { tollInfo: { estimatedPrice: [{ currencyCode: 'ARS', units: '1500' }] } } }] }))
    .mockResolvedValueOnce(response({ routes: [{ distanceMeters: 12000, duration: '2400s', travelAdvisory: { tollInfo: { estimatedPrice: [{ currencyCode: 'ARS', units: '2000' }] } } }] }))
  const result = await estimateTravel({ address: 'Corrientes 1240, CABA, Argentina', departureTime: '2026-09-11T15:00:00Z', apiKey: 'test', origin: 'Obelisco, CABA, Argentina', now, fetcher })
  expect(result).toMatchObject({ outboundKm: 10, returnKm: 12, outboundMinutes: 30, returnMinutes: 40, tolls: 3500, tollsVerified: true, province: 'CABA' })
  expect(fetcher).toHaveBeenCalledTimes(4)
  const body = JSON.parse(fetcher.mock.calls[2][1].body)
  expect(body.routingPreference).toBe('TRAFFIC_AWARE')
  expect(new Date(body.departureTime).getTime()).toBe(Date.parse('2026-09-11T15:00:00Z'))
})
it('rejects foreign/outside-region and ambiguous destinations', async () => {
  const fetcher = vi.fn().mockResolvedValue(response(geocode('Córdoba')))
  await expect(estimateTravel({ address: 'Córdoba', apiKey: 'test', origin: 'CABA', now, fetcher })).rejects.toThrow('outside_coverage')
})
it('uses verified zero when no tolls are expected, but leaves unpriced tolls pending', async () => {
  for (const tollInfo of [undefined, {}]) {
    const fetcher = vi.fn().mockResolvedValueOnce(response(geocode())).mockResolvedValueOnce(response(geocode()))
      .mockImplementation(async () => response({ routes: [{ distanceMeters: 1000, duration: '60s', travelAdvisory: { tollInfo } }] }))
    const result = await estimateTravel({ address: 'CABA', origin: 'CABA', apiKey: 'test', now, fetcher })
    expect(result.tolls).toBe(0)
    expect(result.tollsVerified).toBe(tollInfo === undefined)
  }
})
it('does not invent a travel price when credentials or routes are missing', async () => {
  await expect(estimateTravel({ address: 'CABA', origin: 'CABA', apiKey: '', now })).rejects.toThrow('routing_not_configured')
  const fetcher = vi.fn().mockResolvedValueOnce(response(geocode())).mockResolvedValueOnce(response(geocode())).mockResolvedValue(response({ routes: [] }))
  await expect(estimateTravel({ address: 'CABA', origin: 'CABA', apiKey: 'test', now, fetcher })).rejects.toThrow('route_unavailable')
})
