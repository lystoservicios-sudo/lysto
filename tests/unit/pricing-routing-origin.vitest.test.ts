import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defaultQuotePolicy } from '@/lib/pricing/service-quote'
import { routingAddressKey } from '@/lib/location/verified-points'

const boundary = vi.hoisted(() => ({ session: vi.fn(), policy: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/pricing/server', async importActual => ({
  ...await importActual<typeof import('@/lib/pricing/server')>(),
  getPricingSession: boundary.session,
  getQuotePolicyRecord: boundary.policy,
  quoteWriter: () => ({ rpc: boundary.rpc })
}))
import { POST } from '@/app/api/pricing/quote/route'

const now = new Date('2026-10-25T15:00:00Z')
const origin = 'Pavón 2012, San Cristóbal, CABA, Argentina'
const destination = 'CALLE 23 5871, Berazategui, Buenos Aires, Argentina'
const destinationPoint = {
  formattedAddress: 'CALLE 23 5871, Berazategui, Berazategui, Buenos Aires',
  latitude: -34.76484579742857, longitude: -58.19177827271429,
  province: 'Buenos Aires', precision: 'range_interpolated', coordinateSource: 'georef'
}
const originPoint = {
  formattedAddress: 'Pavón 2012, San Cristóbal, CABA',
  latitude: -34.62658, longitude: -58.39343,
  province: 'CABA', precision: 'range_interpolated', coordinateSource: 'georef'
}
function request(city = 'Berazategui') {
  return new Request('https://lysto.test/api/pricing/quote', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://lysto.test' },
    body: JSON.stringify({ issue: 'mantenimiento', timeSince: 'days', urgency: 'flexible',
      propertyType: 'house', access: { hasParking: true }, equipment: { capacity: 3000, technology: 'conventional' },
      scenario: 'maintenance', materials: [], materialsConfirmed: true,
      address: { street: 'CALLE 23', number: '5871', city, province: 'Buenos Aires' },
      preferredDate: '2026-10-28', timeWindow: '10:00 – 12:00', save: false })
  })
}
function route(distance: number, duration: number) {
  return { routes: [{ summary: { distance, duration }, way_points: [0, 100],
    extras: { tollways: { values: [[0, 100, 0]] } } }] }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now)
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lysto.test')
  vi.stubEnv('OPENROUTESERVICE_API_KEY', 'routing-test-only')
  vi.stubEnv('GOOGLE_MAPS_SERVER_API_KEY', '')
  vi.stubEnv('RATE_LIMIT_HASH_KEY', '')
  vi.stubEnv('LYSTO_ROUTING_ORIGIN', undefined)
  boundary.session.mockResolvedValue({ role: 'admin', assuranceLevel: 'aal2', permissions: ['operations'],
    profileId: '00000000-0000-4000-8000-000000000001', client: {} })
  boundary.policy.mockResolvedValue({ id: null, revision: 1,
    policy: { ...defaultQuotePolicy, approvedUntil: '2026-12-31' } })
  boundary.rpc.mockImplementation(async (name: string, args: { p_key: string }) => ({
    data: name !== 'read_verified_routing_point' ? null : args.p_key === routingAddressKey(destination)
      ? destinationPoint : args.p_key === routingAddressKey(origin) ? originPoint : null,
    error: null
  }))
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })

it.each([undefined, '', '   '])('reports a missing calculator origin before querying a provider instead of blaming the confirmed destination (%s)', async configuredOrigin => {
  vi.stubEnv('LYSTO_ROUTING_ORIGIN', configuredOrigin)
  const fetcher = vi.fn(async () => Response.json({ features: [] }))
  vi.stubGlobal('fetch', fetcher)
  const response = await POST(request())
  expect(response.status).toBe(503)
  expect(await response.json()).toMatchObject({ code: 'routing_not_configured', error: expect.stringContaining('base') })
  expect(fetcher).not.toHaveBeenCalled()
  expect(boundary.rpc).not.toHaveBeenCalled()
})

it('does not reuse the census point for an unconfirmed Oeste identity', async () => {
  vi.stubEnv('LYSTO_ROUTING_ORIGIN', origin)
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.startsWith('https://api.openrouteservice.org/geocode/')) return Response.json({ features: [] })
    expect(url).toContain('https://apis.datos.gob.ar/georef/api/v2.0/direcciones?')
    return Response.json({ cantidad: 1, total: 1, inicio: 0, parametros: {}, direcciones: [{
      altura: { unidad: null, valor: 5871 }, calle: { categoria: 'CALLE', id: '060910100200920', nombre: 'CALLE 23' },
      calle_cruce_1: { categoria: null, id: null, nombre: null }, calle_cruce_2: { categoria: null, id: null, nombre: null },
      departamento: { id: '06091', nombre: 'Berazategui' }, localidad: { id: '0609101002', nombre: 'Berazategui Oeste' },
      localidad_censal: { id: '06091010', nombre: 'Berazategui' }, provincia: { id: '06', nombre: 'Buenos Aires' },
      nomenclatura: 'CALLE 23 5871, Berazategui Oeste, Berazategui, Buenos Aires', piso: null,
      ubicacion: { lat: null, lon: null }
    }] })
  })
  vi.stubGlobal('fetch', fetcher)
  const response = await POST(request('Berazategui Oeste'))
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({ code: 'address_ambiguous' })
  expect(boundary.rpc.mock.calls.some(([, args]) => args.p_key === routingAddressKey(destination))).toBe(false)
  expect(fetcher.mock.calls.every(([url]) => !String(url).includes('/directions/'))).toBe(true)
})

it('uses the confirmed census destination and configured origin without replacing it with Berazategui Oeste', async () => {
  vi.stubEnv('LYSTO_ROUTING_ORIGIN', origin)
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(String(input)).toBe('https://api.openrouteservice.org/v2/directions/driving-car/json')
    const coordinates = JSON.parse(String(init?.body)).coordinates
    const outward = coordinates[0][0] === originPoint.longitude
    expect(coordinates).toEqual(outward
      ? [[originPoint.longitude, originPoint.latitude], [destinationPoint.longitude, destinationPoint.latitude]]
      : [[destinationPoint.longitude, destinationPoint.latitude], [originPoint.longitude, originPoint.latitude]])
    return Response.json(outward ? route(33000, 2700) : route(35000, 3000))
  })
  vi.stubGlobal('fetch', fetcher)
  const response = await POST(request())
  expect(response.status).toBe(200)
  const data = await response.json()
  expect(data).toMatchObject({ quoteId: null, routingNotice: null, quote: { readyToOffer: true, coverage: 'covered',
    route: { source: 'openrouteservice', destination: destinationPoint.formattedAddress, outboundKm: 33, returnKm: 35,
      outboundMinutes: 45, returnMinutes: 50, tollsVerified: true } } })
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(boundary.rpc.mock.calls.map(([, args]) => args.p_key)).toEqual([
    routingAddressKey(destination), routingAddressKey(origin)
  ])
  expect(boundary.rpc.mock.calls.every(([name]) => name === 'read_verified_routing_point')).toBe(true)
})
