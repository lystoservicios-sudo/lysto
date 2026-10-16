import { describe, expect, it } from 'vitest'

import { issueLocationProof, readAuthenticLocationProof, verifyFormattedLocationProof, verifyLocationProof } from '@/lib/location/proof'
import type { ResolvedAddress } from '@/lib/location/contracts'

const secret = '0123456789abcdef0123456789abcdef'
const now = new Date('2026-10-16T15:00:00.000Z')
const address: ResolvedAddress = {
  street: 'AV RIVADAVIA', number: '1234', city: 'San Nicolás', province: 'CABA',
  provinceId: '02', cityId: '02007010', streetId: '0200701000085',
  formattedAddress: 'Av. Rivadavia 1234, CABA, Argentina', latitude: -34.609,
  longitude: -58.389, precision: 'rooftop', source: 'georef_google'
}

describe('signed location proof', () => {
  it('round trips a canonical address for thirty minutes', () => {
    const proof = issueLocationProof(address, secret, now)
    expect(verifyLocationProof(proof, { street: 'AV RIVADAVIA', number: '1234', city: 'San Nicolás', province: 'CABA' }, secret, new Date(now.getTime() + 29 * 60_000))).toEqual(address)
  })

  it('rejects an expired proof', () => {
    const proof = issueLocationProof(address, secret, now)
    expect(() => verifyLocationProof(proof, address, secret, new Date(now.getTime() + 31 * 60_000))).toThrow('location_proof_expired')
  })

  it('recovers provider identifiers from an authentic expired proof for fresh resolution', () => {
    const issued = issueLocationProof(address, secret, new Date('2026-10-16T10:00:00Z'))
    expect(readAuthenticLocationProof(issued, address, secret, new Date('2026-10-16T11:00:00Z'))).toEqual(address)
  })

  it('rejects payload and signature tampering', () => {
    const proof = issueLocationProof(address, secret, now)
    const [payload, signature] = proof.split('.')
    expect(() => verifyLocationProof(`${payload.slice(0, -1)}A.${signature}`, address, secret, now)).toThrow('location_proof_invalid')
    expect(() => verifyLocationProof(`${payload}.${signature.slice(0, -1)}A`, address, secret, now)).toThrow('location_proof_invalid')
  })

  it('rejects a valid proof reused with different address text', () => {
    const proof = issueLocationProof(address, secret, now)
    expect(() => verifyLocationProof(proof, { ...address, number: '1235' }, secret, now)).toThrow('location_proof_mismatch')
  })

  it('verifies the canonical formatted address used by technician onboarding', () => {
    const proof = issueLocationProof(address, secret, now)
    expect(verifyFormattedLocationProof(proof, address.formattedAddress, secret, now)).toEqual(address)
    expect(() => verifyFormattedLocationProof(proof, 'Otra dirección', secret, now)).toThrow('location_proof_mismatch')
  })
})
