// @vitest-environment node
import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/location/resolve/route'
import { POST as RENEW } from '@/app/api/location/renew/route'
import { ApiError } from '@/lib/http/api-error'
import { addressResolutionInputSchema, resolvedAddressSchema, type ResolvedAddress } from '@/lib/location/contracts'
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
const selection = { street: 'Calle de prueba', number: '123', city: 'Quilmes', province: 'Buenos Aires' }
const manual = { ...selection, provinceId: '06', formattedAddress: 'Calle de prueba 123, Quilmes, Buenos Aires, Argentina',
  source: 'manual', precision: 'unverified', latitude: null, longitude: null }
// Recreate the retired v1 token independently of today's issuing schema.
function legacyProof(expiresAt = now.getTime() + 30 * 60_000) {
  const payload = Buffer.from(JSON.stringify({ version: 1, expiresAt, address: manual })).toString('base64url')
  const signature = createHmac('sha256', secret).update('lysto-location-proof-v1\0').update(payload).digest('base64url')
  return `${payload}.${signature}`
}
function request(path: 'resolve' | 'renew', body: unknown) {
  return new Request(`http://localhost/api/location/${path}`, { method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify(body) })
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now)
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost'); vi.stubEnv('LOCATION_PROOF_SECRET', secret)
  state.denied = false
  state.rpc.mockReset().mockResolvedValue({ data: null, error: null })
  state.fetch.mockReset().mockRejectedValue(new Error('provider_must_not_be_called'))
  state.limit.mockReset().mockResolvedValue({ allowed: true }); vi.stubGlobal('fetch', state.fetch)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('retired manual address fallback', () => {
  it.each(['CABA', 'Buenos Aires', 'Córdoba', 'Santa Fe'])('rejects mode manual in %s before providers or storage', async province => {
    const input = { mode: 'manual', ...selection, province }
    expect(addressResolutionInputSchema.safeParse(input).success).toBe(false)
    await expect(resolveArgentineAddress(input)).rejects.toThrow()
    expect((await POST(request('resolve', input))).status).toBe(400)
    expect(state.fetch).not.toHaveBeenCalled(); expect(state.rpc).not.toHaveBeenCalled()
  })
  it.each([manual, { ...manual, latitude: -34.7, longitude: -58.3 }, { ...manual, source: 'georef', cityId: 'city', streetId: 'street' }])('rejects the retired contract even when coordinates or IDs are supplied', address => {
    expect(resolvedAddressSchema.safeParse(address).success).toBe(false)
    expect(() => issueLocationProof(address as unknown as ResolvedAddress, secret, now)).toThrow()
  })
  it.each([30, -30])('rejects an authentic manual token with expiration offset %s minutes in every proof consumer', minutes => {
    const proof = legacyProof(now.getTime() + minutes * 60_000)
    expect(() => verifyLocationProof(proof, selection, secret, now)).toThrow('location_proof_invalid')
    expect(() => readAuthenticLocationProof(proof, selection, secret, now)).toThrow('location_proof_invalid')
    expect(() => verifyFormattedLocationProof(proof, manual.formattedAddress, secret, now)).toThrow('location_proof_invalid')
    expect(() => canonicalizeAddressMutation({ ...selection, locationProof: proof }, null, secret)).toThrow('location_proof_invalid')
  })
  it.each([30, -30])('never renews or geocodes an authentic retired manual token (%s minutes)', async minutes => {
    const response = await RENEW(request('renew', { ...selection, proof: legacyProof(now.getTime() + minutes * 60_000) }))
    expect(response.status).not.toBe(200); expect(await response.json()).not.toHaveProperty('proof')
    expect(state.fetch).not.toHaveBeenCalled(); expect(state.rpc).not.toHaveBeenCalled()
  })
  it.each([manual, { ...manual, latitude: -34.7, longitude: -58.3, precision: 'rooftop' }])('never caches retired manual objects passed through an untyped caller', async address => {
    await expect(rememberResolvedAddress(address as unknown as ResolvedAddress)).rejects.toThrow()
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it('keeps authentication required even for rejected manual input', async () => {
    state.denied = true
    expect((await POST(request('resolve', { mode: 'manual', ...selection }))).status).toBe(401)
    expect(state.fetch).not.toHaveBeenCalled()
  })
})
