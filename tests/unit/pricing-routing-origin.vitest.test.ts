import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defaultQuotePolicy, type TravelEstimate } from '@/lib/pricing/service-quote'
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
function request(city = 'Berazategui', number = '5871', manual?: { route: TravelEstimate; reason?: string }) {
  return new Request('https://lysto.test/api/pricing/quote', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://lysto.test' },
    body: JSON.stringify({ issue: 'mantenimiento', timeSince: 'days', urgency: 'flexible',
      propertyType: 'house', access: { hasParking: true }, equipment: { capacity: 3000, technology: 'conventional' },
      scenario: 'maintenance', materials: [], materialsConfirmed: true,
      address: { street: 'CALLE 23', number, city, province: 'Buenos Aires' },
      ...(manual ? { manualRoute: manual.route, ...(manual.reason ? { manualRouteReason: manual.reason } : {}) } : {}),
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

it.each([undefined, '', '   '])('keeps an administrative calculation in review when no departure point is available (%s)', async configuredOrigin => {
  vi.stubEnv('LYSTO_ROUTING_ORIGIN', configuredOrigin)
  const fetcher = vi.fn(async () => Response.json({ features: [] }))
  vi.stubGlobal('fetch', fetcher)
  const response = await POST(request())
  expect(response.status).toBe(200)
  const data = await response.json()
  expect(data).toMatchObject({ quoteId: null, routingNotice: expect.stringContaining('profesional asignado'),
    quote: { route: null, readyToOffer: false, reviewReasons: expect.arrayContaining(['travel_unverified']) } })
  expect(fetcher).not.toHaveBeenCalled()
  expect(boundary.rpc).not.toHaveBeenCalled()
})

it.each(['S/N', ' sin número ', 'km 12,5', '1234567', 'A'.repeat(30)])('rejects an unvalidated textual house number before routing (%s)', async number => {
  vi.stubEnv('LYSTO_ROUTING_ORIGIN', origin)
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
  const response = await POST(request('Berazategui', number))
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({ code: 'invalid_input' })
  expect(fetcher).not.toHaveBeenCalled()
  expect(boundary.rpc).not.toHaveBeenCalled()
})

it.each(['', '   ', 'A'.repeat(31)])('rejects an empty or oversized house number before routing (%s)', async number => {
  vi.stubEnv('LYSTO_ROUTING_ORIGIN', origin)
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const response = await POST(request('Berazategui', number))
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({ code: 'invalid_input' })
  expect(fetcher).not.toHaveBeenCalled()
  expect(boundary.rpc).not.toHaveBeenCalled()
})

const manualRoute: TravelEstimate = {
  source: 'manual', origin: 'Base verificada por operaciones', destination: 'CALLE 23 5871, Berazategui',
  province: 'Buenos Aires', outboundKm: 30, returnKm: 32, outboundMinutes: 45, returnMinutes: 50,
  tolls: 0, tollsVerified: true, measuredAt: now.toISOString()
}
const manualReason = 'Recorrido y tiempos verificados por operaciones para la dirección sin altura.'

it('preserves an authorized administrative route and its financial review for a validated numeric house number', async () => {
  vi.stubEnv('LYSTO_ROUTING_ORIGIN', origin)
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const response = await POST(request('Berazategui', '5871', { route: manualRoute, reason: manualReason }))
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ routingNotice: null,
    quote: { route: manualRoute, readyToOffer: false, reviewReasons: expect.arrayContaining(['travel_unverified']) } })
  expect(fetcher).not.toHaveBeenCalled()
  expect(boundary.rpc).not.toHaveBeenCalled()
})

it('cannot use an operations route to bypass address height validation', async () => {
  const response = await POST(request('Berazategui', 'S/N', { route: manualRoute, reason: manualReason }))
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({ code: 'invalid_input' })
})

it('still requires an explanation for an administrative manual route', async () => {
  const response = await POST(request('Berazategui', '5871', { route: manualRoute }))
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({ code: 'invalid_input' })
})

it.each([
  { role: 'customer', assuranceLevel: 'aal1', permissions: [] },
  { role: 'admin', assuranceLevel: 'aal2', permissions: ['finance'] }
])('does not let a $role without operations authorization use a manual route', async authority => {
  boundary.session.mockResolvedValue({ ...authority,
    profileId: '00000000-0000-4000-8000-000000000001', client: {} })
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const input = await request('Berazategui', '5871', { route: manualRoute, reason: manualReason }).json()
  delete input.scenario
  input.materialsConfirmed = false
  const response = await POST(new Request('https://lysto.test/api/pricing/quote', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://lysto.test' },
    body: JSON.stringify(input)
  }))
  expect(response.status).toBe(403)
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
