// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/location/resolve/route'
import { POST as RENEW } from '@/app/api/location/renew/route'
import { ApiError } from '@/lib/http/api-error'
import { resolvedAddressSchema, type ResolvedAddress } from '@/lib/location/contracts'
import { canonicalizeAddressMutation } from '@/lib/location/mutation'
import { issueLocationProof, readAuthenticLocationProof, verifyFormattedLocationProof, verifyLocationProof } from '@/lib/location/proof'
import { resolveArgentineAddress } from '@/lib/location/resolve'
import { rememberResolvedAddress } from '@/lib/location/verified-points'

const state = vi.hoisted(() => ({ rpc: vi.fn(), fetch: vi.fn(), denied: false, limit: vi.fn() }))
vi.mock('@/lib/pricing/server', () => ({ quoteWriter: () => ({ rpc: state.rpc }) }))
vi.mock('@/lib/auth/session', () => ({
  requireAdminPermission: vi.fn(),
  requireSecuritySession: async () => {
    if (state.denied) throw new ApiError('unauthorized')
    return { role: 'customer', profileId: '10000000-0000-4000-8000-000000000001' }
  }
}))
vi.mock('@/lib/security/rate-limit', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/security/rate-limit')>()
  return { ...actual, enforceRateLimit: state.limit }
})

const secret = 'manual-location-proof-test-secret-32-bytes'
const now = new Date('2026-10-26T12:00:00.000Z')
const selection = { street: 'Calle de prueba', number: '123', city: 'Quilmes', province: 'Buenos Aires' } as const
const manual = {
  ...selection, provinceId: '06', formattedAddress: 'Calle de prueba 123, Quilmes, Buenos Aires, Argentina',
  source: 'manual', precision: 'unverified', latitude: null, longitude: null
} as const satisfies ResolvedAddress

function request(path: 'resolve' | 'renew', body: unknown) {
  return new Request(`http://localhost/api/location/${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify(body)
  })
}

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now)
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost')
  vi.stubEnv('LOCATION_PROOF_SECRET', secret)
  state.denied = false
  state.rpc.mockReset().mockResolvedValue({ data: null, error: null })
  state.fetch.mockReset().mockRejectedValue(new Error('provider_must_not_be_called'))
  state.limit.mockReset().mockResolvedValue({ allowed: true })
  vi.stubGlobal('fetch', state.fetch)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('manual address resolution', () => {
  it.each([['Buenos Aires', 'Quilmes', '06'], ['CABA', 'San Cristóbal', '02']])('records %s without coordinates or invented provider identifiers', async (province, city, provinceId) => {
    const address = await resolveArgentineAddress({ mode: 'manual', ...selection, street: '  Calle de prueba  ', province, city })
    expect(address).toEqual({ ...manual, province, city, provinceId,
      formattedAddress: `Calle de prueba 123, ${city}, ${province}, Argentina` })
    expect(address).not.toHaveProperty('cityId')
    expect(address).not.toHaveProperty('streetId')
    expect(state.fetch).not.toHaveBeenCalled()
  })

  it('accepts only the unverified null-coordinate manual contract', () => {
    expect(resolvedAddressSchema.safeParse(manual).success).toBe(true)
    expect(resolvedAddressSchema.safeParse({ ...manual, latitude: -34.7, longitude: -58.3 }).success).toBe(false)
    expect(resolvedAddressSchema.safeParse({ ...manual, precision: 'rooftop' }).success).toBe(false)
    expect(resolvedAddressSchema.safeParse({ ...manual, source: 'georef' }).success).toBe(false)
    expect(resolvedAddressSchema.safeParse({ ...manual, provinceId: '02' }).success).toBe(false)
  })

  it.each(['Córdoba', 'Santa Fe'])('rejects a manual address outside coverage: %s', async province => {
    await expect(resolveArgentineAddress({ mode: 'manual', ...selection, province })).rejects.toThrow()
    expect(state.fetch).not.toHaveBeenCalled()
  })

  it.each([{ latitude: -34.7, longitude: -58.3 }, { latitude: null, longitude: null }, { provinceId: '06' }, { cityId: 'invented' }])('rejects supplied coordinates or identifiers: %j', async supplied => {
    await expect(resolveArgentineAddress({ mode: 'manual', ...selection, ...supplied })).rejects.toThrow()
    expect(state.fetch).not.toHaveBeenCalled()
  })

  it.each([{ street: 'A'.repeat(151) }, { city: 'A'.repeat(101) }, { number: 'A'.repeat(31) }])('keeps manual fields compatible with saved addresses: %j', async fields => {
    await expect(resolveArgentineAddress({ mode: 'manual', ...selection, ...fields })).rejects.toThrow()
    expect(state.fetch).not.toHaveBeenCalled()
  })

  it.each(['S/N', 'km 5'])('preserves the real textual house number %s in its signed receipt', async number => {
    const expected = { ...selection, number }
    const address = await resolveArgentineAddress({ mode: 'manual', ...expected })
    const proof = issueLocationProof(address, secret, now)
    expect(verifyLocationProof(proof, expected, secret, now)).toEqual({ ...manual, number,
      formattedAddress: `Calle de prueba ${number}, Quilmes, Buenos Aires, Argentina` })
    expect(() => verifyLocationProof(proof, { ...expected, number: '1' }, secret, now)).toThrow('location_proof_mismatch')
    expect(state.fetch).not.toHaveBeenCalled()
  })

  it('rejects a manual display address longer than the professional address limit', async () => {
    await expect(resolveArgentineAddress({ mode: 'manual', ...selection, street: 'A'.repeat(140), city: 'B'.repeat(70) })).rejects.toThrow('manual_address_too_long')
    expect(state.fetch).not.toHaveBeenCalled()
  })

  it('does not change verified address lengths or provider identifier requirements', () => {
    const verified = { ...manual, street: 'A'.repeat(160), number: '1234567', provinceId: '06', cityId: 'city', streetId: 'street',
      formattedAddress: 'A'.repeat(220), source: 'georef', precision: 'range_interpolated', latitude: -34.7, longitude: -58.3 }
    expect(resolvedAddressSchema.safeParse(verified).success).toBe(true)
    expect(resolvedAddressSchema.safeParse({ ...verified, cityId: undefined }).success).toBe(false)
  })

  it('never stores a manual address as a verified routing point', async () => {
    await expect(rememberResolvedAddress(manual)).resolves.toBeUndefined()
    expect(state.rpc).not.toHaveBeenCalled()
  })
})

describe('manual address proofs', () => {
  it('signs the unverified address and accepts it for a new saved address', () => {
    const proof = issueLocationProof(manual, secret, now)
    expect(verifyLocationProof(proof, selection, secret, now)).toEqual(manual)
    expect(verifyFormattedLocationProof(proof, manual.formattedAddress, secret, now)).toEqual(manual)
    expect(canonicalizeAddressMutation({ ...selection, locationProof: proof }, null, secret)).toEqual(selection)
  })

  it('rejects a manual proof reused for different address text', () => {
    const proof = issueLocationProof(manual, secret, now)
    expect(() => verifyLocationProof(proof, { ...selection, number: '124' }, secret, now)).toThrow('location_proof_mismatch')
    expect(() => verifyFormattedLocationProof(proof, 'Otra dirección', secret, now)).toThrow('location_proof_mismatch')
  })

  it('expires after thirty minutes while preserving the authentic manual selection for renewal', () => {
    const proof = issueLocationProof(manual, secret, now)
    const later = new Date(now.getTime() + 31 * 60_000)
    expect(() => verifyLocationProof(proof, selection, secret, later)).toThrow('location_proof_expired')
    expect(readAuthenticLocationProof(proof, selection, secret, later)).toEqual(manual)
  })

  it('rejects promotion to verified coordinates by editing the signed payload', () => {
    const proof = issueLocationProof(manual, secret, now)
    const [payload, signature] = proof.split('.')
    const forged = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    forged.address.latitude = -34.7; forged.address.longitude = -58.3; forged.address.precision = 'rooftop'
    const token = `${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${signature}`
    expect(() => readAuthenticLocationProof(token, selection, secret, now)).toThrow('location_proof_invalid')
  })
})

describe('private manual location routes', () => {
  it('returns a signed manual receipt without contacting providers or storage', async () => {
    const response = await POST(request('resolve', { mode: 'manual', ...selection }))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    const body = await response.json()
    expect(body.address).toEqual(manual)
    expect(verifyLocationProof(body.proof, selection, secret, now)).toEqual(manual)
    expect(state.fetch).not.toHaveBeenCalled()
    expect(state.rpc).not.toHaveBeenCalled()
  })

  it('renews an expired authentic manual receipt without geocoding or promotion', async () => {
    const proof = issueLocationProof(manual, secret, now)
    const later = new Date(now.getTime() + 31 * 60_000)
    vi.setSystemTime(later)
    const response = await RENEW(request('renew', { ...selection, proof }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.proof).not.toBe(proof)
    expect(body.address).toEqual(manual)
    expect(verifyLocationProof(body.proof, selection, secret, later)).toEqual(manual)
    expect(state.fetch).not.toHaveBeenCalled()
    expect(state.rpc).not.toHaveBeenCalled()
  })

  it.each([{ latitude: -34.7, longitude: -58.3 }, { province: 'Córdoba' }])('rejects an invalid manual HTTP request: %j', async fields => {
    const response = await POST(request('resolve', { mode: 'manual', ...selection, ...fields }))
    expect(response.status).toBe(400)
    expect(state.fetch).not.toHaveBeenCalled()
    expect(state.rpc).not.toHaveBeenCalled()
  })

  it('keeps manual resolution behind the existing authenticated session', async () => {
    state.denied = true
    expect((await POST(request('resolve', { mode: 'manual', ...selection }))).status).toBe(401)
    expect(state.fetch).not.toHaveBeenCalled()
    expect(state.rpc).not.toHaveBeenCalled()
  })
})
