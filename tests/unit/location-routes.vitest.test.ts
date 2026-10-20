import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from '@/app/api/location/suggestions/route'
import { POST } from '@/app/api/location/resolve/route'
import { POST as RENEW } from '@/app/api/location/renew/route'
import { ApiError } from '@/lib/http/api-error'

const state = vi.hoisted(() => ({
  role: 'customer', denied: false, suggest: vi.fn(), resolve: vi.fn(), issue: vi.fn(), readProof: vi.fn(), limit: vi.fn(), remember: vi.fn()
}))
vi.mock('@/lib/auth/session', () => ({
  requireSecuritySession: async () => {
    if (state.denied) throw new ApiError('unauthorized')
    return { role: state.role, profileId: '10000000-0000-4000-8000-000000000001' }
  }
}))
vi.mock('@/lib/location/georef', () => ({ suggestLocations: state.suggest }))
vi.mock('@/lib/location/resolve', () => ({ resolveArgentineAddress: state.resolve }))
vi.mock('@/lib/location/verified-points', () => ({ rememberResolvedAddress: state.remember }))
vi.mock('@/lib/location/proof', () => ({ issueLocationProof: state.issue, readAuthenticLocationProof: state.readProof }))
vi.mock('@/lib/security/rate-limit', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/security/rate-limit')>()
  return { ...actual, enforceRateLimit: state.limit }
})

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost')
  state.role = 'customer'; state.denied = false
  state.suggest.mockReset().mockResolvedValue([{ kind: 'province', id: '06', label: 'Buenos Aires' }])
  state.resolve.mockReset().mockResolvedValue({ street: 'GRL BELGRANO', number: '123', city: 'Quilmes Oeste', province: 'Buenos Aires', provinceId: '06', cityId: '0665801007', streetId: '066580100704335', formattedAddress: 'GRL BELGRANO 123, Quilmes Oeste, Buenos Aires', latitude: -34.7, longitude: -58.3, precision: 'rooftop', source: 'georef_google' })
  state.issue.mockReset().mockReturnValue('signed-location-proof')
  state.readProof.mockReset().mockReturnValue({ provinceId: '06', cityId: '0665801007', streetId: '066580100704335' })
  state.limit.mockReset().mockResolvedValue({ allowed: true })
  state.remember.mockReset().mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllEnvs())

describe('private location HTTP routes', () => {
  it('returns private suggestions to an authenticated customer', async () => {
    const response = await GET(new Request('http://localhost/api/location/suggestions?kind=province&query=buenos'))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(await response.json()).toMatchObject({ suggestions: [{ id: '06' }] })
    expect(state.limit).toHaveBeenCalledWith('location', expect.stringContaining('10000000-0000-4000-8000-000000000001'))
  })

  it('allows a professional still in onboarding to resolve an address', async () => {
    state.role = 'professional'
    const response = await POST(new Request('http://localhost/api/location/resolve', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify({ street: 'GRL BELGRANO', number: '123', city: 'Quilmes Oeste', province: 'Buenos Aires', provinceId: '06', cityId: '0665801007', streetId: '066580100704335' }) }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ proof: 'signed-location-proof', address: { street: 'GRL BELGRANO' } })
    expect(state.remember).toHaveBeenCalledWith(expect.objectContaining({latitude:-34.7,longitude:-58.3}))
  })

  it('renews an authentic proof inside the same private session', async () => {
    const response = await RENEW(new Request('http://localhost/api/location/renew', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify({ proof: 'x'.repeat(40), street: 'GRL BELGRANO', number: '123', city: 'Quilmes Oeste', province: 'Buenos Aires' }) }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ proof: 'signed-location-proof', address: { street: 'GRL BELGRANO' } })
    expect(state.readProof).toHaveBeenCalledWith('x'.repeat(40), expect.objectContaining({ number: '123' }))
    expect(state.resolve).toHaveBeenCalledWith(expect.objectContaining({ streetId: '066580100704335' }))
  })

  it('rejects anonymous and admin access before contacting providers', async () => {
    state.denied = true
    expect((await GET(new Request('http://localhost/api/location/suggestions?kind=province&query=buenos'))).status).toBe(401)
    state.denied = false; state.role = 'admin'
    expect((await GET(new Request('http://localhost/api/location/suggestions?kind=province&query=buenos'))).status).toBe(403)
    expect(state.suggest).not.toHaveBeenCalled()
  })

  it('rejects malformed queries and provider failures without exposing details', async () => {
    expect((await GET(new Request('http://localhost/api/location/suggestions?kind=street&query=x'))).status).toBe(400)
    state.suggest.mockRejectedValue(new Error('upstream detail'))
    const response = await GET(new Request('http://localhost/api/location/suggestions?kind=province&query=buenos'))
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('upstream detail')
  })
})
