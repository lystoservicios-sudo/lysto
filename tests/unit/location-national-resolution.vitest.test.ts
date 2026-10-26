// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveArgentineAddress } from '@/lib/location/resolve'
import { geocodeVerifiedAddress } from '@/lib/location/google-geocoding'
import { geocodeOpenRouteAddress } from '@/lib/location/openrouteservice'
import { geocodeRoutingAddress } from '@/lib/location/routing-geocoding'
import { rememberResolvedAddress } from '@/lib/location/verified-points'
import { issueLocationProof, verifyLocationProof } from '@/lib/location/proof'
import type { GeorefAddress } from '@/lib/location/georef'
const state = vi.hoisted(() => ({ georef: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/location/georef', () => ({ georefAddresses: state.georef }))
vi.mock('@/lib/pricing/server', () => ({ quoteWriter: () => ({ rpc: state.rpc }) }))
const locations = [
  { id: '14', province: 'Córdoba', city: 'Córdoba', lat: -31.4135, lon: -64.181 },
  { id: '82', province: 'Santa Fe', city: 'Rosario', lat: -32.9442, lon: -60.6505 }
]
function official(location = locations[0], point = true): GeorefAddress {
  const territory = { id: `${location.id}001`, nombre: location.city }, empty = { id: null, nombre: null, categoria: null }
  return { altura: { unidad: null, valor: 123 }, calle: { categoria: 'CALLE', id: `${location.id}001street`, nombre: 'BELGRANO' },
    calle_cruce_1: empty, calle_cruce_2: empty, departamento: territory, localidad: territory, localidad_censal: territory,
    provincia: { id: location.id, nombre: location.province }, nomenclatura: `BELGRANO 123, ${location.city}, ${location.province}`,
    piso: null, ubicacion: { lat: point ? location.lat : null, lon: point ? location.lon : null } }
}
function selection(location = locations[0]) {
  return { street: 'BELGRANO', number: '123', city: location.city, province: location.province,
    provinceId: location.id, cityId: `${location.id}001`, streetId: `${location.id}001street` }
}
function google(location = locations[0], precision = 'ROOFTOP', country = 'AR') {
  return { status: 'OK', results: [{ formatted_address: `Belgrano 123, ${location.city}, ${location.province}, Argentina`,
    geometry: { location: { lat: location.lat, lng: location.lon }, location_type: precision },
    address_components: [{ long_name: 'Argentina', short_name: country, types: ['country'] },
      { long_name: location.province, short_name: location.province, types: ['administrative_area_level_1'] }] }] }
}
function ors(location = locations[0], layer = 'address') {
  return { features: [{ geometry: { type: 'Point', coordinates: [location.lon, location.lat] }, properties: {
    label: `Belgrano 123, ${location.city}, ${location.province}, Argentina`, layer, housenumber: '123', street: 'Belgrano',
    locality: location.city, country_a: 'ARG', region: location.province, accuracy: 'point', confidence: 1, match_type: 'exact'
  } }] }
}
beforeEach(() => { state.georef.mockReset(); state.rpc.mockReset(); vi.stubEnv('OPENROUTESERVICE_API_KEY', '') })
afterEach(() => vi.unstubAllEnvs())
describe('verified national addresses without expanding commercial coverage', () => {
  it.each(locations)('verifies and signs a precise Google address in $province', async location => {
    state.georef.mockResolvedValue([official(location)])
    const address = await resolveArgentineAddress(selection(location), { apiKey: 'fixture', orsApiKey: '', googleFetcher: vi.fn(async () => Response.json(google(location))) })
    expect(address).toMatchObject({ ...selection(location), latitude: location.lat, longitude: location.lon, source: 'georef_google', precision: 'rooftop' })
    const secret = 'national-proof-test-secret-32-characters'
    expect(verifyLocationProof(issueLocationProof(address, secret), selection(location), secret)).toEqual(address)
    await rememberResolvedAddress(address); expect(state.rpc).not.toHaveBeenCalled()
  })
  it.each(locations)('uses a precise OpenRouteService point for a selected $province address', async location => {
    state.georef.mockResolvedValue([official(location)])
    const orsFetcher = vi.fn(async () => Response.json(ors(location)))
    await expect(resolveArgentineAddress(selection(location), { orsApiKey: 'fixture', orsFetcher })).resolves.toMatchObject({
      province: location.province, latitude: location.lat, longitude: location.lon, source: 'georef_openrouteservice' })
    expect(orsFetcher).toHaveBeenCalledTimes(1)
  })
  it('retains an official exact address point when ORS returns only a centroid', async () => {
    state.georef.mockResolvedValue([official()])
    const orsFetcher = vi.fn(async () => Response.json(ors(locations[0], 'locality')))
    await expect(resolveArgentineAddress(selection(), { orsApiKey: 'fixture', orsFetcher })).resolves.toMatchObject({
      province: 'Córdoba', latitude: locations[0].lat, longitude: locations[0].lon, source: 'georef', precision: 'range_interpolated' })
    expect(state.georef).toHaveBeenCalledTimes(1)
  })
  it('retries structured national lookup without inventing a missing official point', async () => {
    state.georef.mockResolvedValue([official(locations[1], false)])
    const orsFetcher = vi.fn().mockResolvedValueOnce(Response.json({ features: [] })).mockResolvedValueOnce(Response.json(ors(locations[1])))
    await expect(resolveArgentineAddress(selection(locations[1]), { orsApiKey: 'fixture', orsFetcher })).resolves.toMatchObject({
      province: 'Santa Fe', latitude: locations[1].lat, longitude: locations[1].lon, source: 'georef_openrouteservice' })
    const url = new URL(String(orsFetcher.mock.calls[1][0]))
    expect(url.pathname).toBe('/geocode/search/structured'); expect(url.searchParams.get('region')).toBe('Santa Fe')
    expect(url.searchParams.get('locality')).toBe('Rosario')
  })
  it('rejects a missing address point instead of substituting a city centroid', async () => {
    state.georef.mockResolvedValue([official(locations[0], false)])
    await expect(resolveArgentineAddress(selection(), { orsApiKey: 'fixture', orsFetcher: vi.fn(async () => Response.json(ors(locations[0], 'locality'))) })).rejects.toThrow('address_ambiguous')
  })
  it.each([{ province: 'Buenos Aires', provinceId: '14' }, { province: 'Atlantis', provinceId: '14' }, { province: '', provinceId: '14' }])('rejects contradictory or absent province context before providers: %j', async context => {
    await expect(resolveArgentineAddress({ ...selection(), ...context })).rejects.toThrow(); expect(state.georef).not.toHaveBeenCalled()
  })
  it('rejects a provider point from another Argentine province', async () => {
    state.georef.mockResolvedValue([official()])
    await expect(resolveArgentineAddress(selection(), { apiKey: 'fixture', orsApiKey: '', googleFetcher: vi.fn(async () => Response.json(google(locations[1]))) })).rejects.toThrow('address_ambiguous')
  })
  it('keeps the selected province authoritative when the optional ID is absent', async () => {
    state.georef.mockResolvedValue([official(locations[1])])
    const googleFetcher = vi.fn()
    await expect(resolveArgentineAddress({ ...selection(), provinceId: undefined }, { apiKey: 'fixture', orsApiKey: '', googleFetcher })).rejects.toThrow('address_unresolved')
    expect(state.georef).toHaveBeenCalledWith(expect.objectContaining({ province: 'Córdoba', provinceId: '14' }), undefined)
    expect(googleFetcher).not.toHaveBeenCalled()
  })
  it.each(['GEOMETRIC_CENTER', 'APPROXIMATE'])('rejects Google centroid precision %s', async precision => {
    const caba = { id: '02', province: 'CABA', city: 'CABA', lat: -34.6, lon: -58.4 }
    await expect(geocodeVerifiedAddress('Belgrano 123, CABA', 'fixture', vi.fn(async () => Response.json(google(caba, precision))))).rejects.toThrow('address_ambiguous')
  })
  it('rejects a non-Argentine Google point even with an Argentine province name', async () => {
    await expect(geocodeVerifiedAddress('Belgrano 123, Córdoba', 'fixture', vi.fn(async () => Response.json(google(locations[0], 'ROOFTOP', 'UY'))))).rejects.toThrow('outside_coverage')
  })
  it('keeps the existing routing geocoder restricted to the commercial service area', async () => {
    await expect(geocodeOpenRouteAddress('BELGRANO 123, Córdoba, Córdoba, Argentina', 'fixture', vi.fn(async () => Response.json(ors())))).rejects.toThrow('outside_coverage')
  })
  it('keeps the pricing routing fallback outside the national registration path', async () => {
    await expect(geocodeRoutingAddress('BELGRANO 123, Córdoba, Córdoba, Argentina', 'fixture', vi.fn(async () => Response.json(ors())))).rejects.toThrow('outside_coverage')
    expect(state.georef).not.toHaveBeenCalled()
  })
})
