import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

import { addressSelectionSchema, resolvedAddressSchema, type ResolvedAddress } from './contracts'

const payloadSchema = z.object({
  version: z.literal(1),
  expiresAt: z.number().int().positive(),
  address: resolvedAddressSchema
}).strict()

function safeSecret(secret?: string) {
  const value = secret ?? process.env.LOCATION_PROOF_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (Buffer.byteLength(value) < 32) throw new Error('location_proof_secret_required')
  return value
}

function signature(payload: string, secret: string) {
  return createHmac('sha256', safeSecret(secret)).update('lysto-location-proof-v1\0').update(payload).digest('base64url')
}

function comparable(value: string) {
  return value.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR')
}

export function issueLocationProof(address: ResolvedAddress, secret?: string, now = new Date()) {
  const payload = Buffer.from(JSON.stringify(payloadSchema.parse({
    version: 1, expiresAt: now.getTime() + 30 * 60_000, address
  }))).toString('base64url')
  return `${payload}.${signature(payload, safeSecret(secret))}`
}

function verifiedPayload(token: string, secret?: string, now = new Date(), allowExpired = false) {
  const [payload, supplied, extra] = token.split('.')
  if (!payload || !supplied || extra) throw new Error('location_proof_invalid')
  const calculated = signature(payload, safeSecret(secret))
  const expectedBuffer = Buffer.from(calculated)
  const suppliedBuffer = Buffer.from(supplied)
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) throw new Error('location_proof_invalid')
  let parsed: z.infer<typeof payloadSchema>
  try { parsed = payloadSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))) }
  catch { throw new Error('location_proof_invalid') }
  if (!allowExpired && parsed.expiresAt < now.getTime()) throw new Error('location_proof_expired')
  return parsed.address
}

function assertExpectedAddress(address: ResolvedAddress, expected: Pick<ResolvedAddress, 'street' | 'number' | 'city' | 'province'>) {
  const selected = addressSelectionSchema.pick({ street: true, number: true, city: true, province: true }).parse({
    street: expected.street, number: expected.number, city: expected.city, province: expected.province
  })
  if ((['street', 'number', 'city', 'province'] as const).some((key) => comparable(address[key]) !== comparable(selected[key]))) throw new Error('location_proof_mismatch')
}

export function verifyLocationProof(token: string, expected: Pick<ResolvedAddress, 'street' | 'number' | 'city' | 'province'>, secret?: string, now = new Date()) {
  const address = verifiedPayload(token, secret, now)
  assertExpectedAddress(address, expected)
  return address
}

/** Recovers an authentic selection for renewal. Provider selections must be
 * resolved again; manual selections may only be reissued as unverified. */
export function readAuthenticLocationProof(token: string, expected: Pick<ResolvedAddress, 'street' | 'number' | 'city' | 'province'>, secret?: string, now = new Date()) {
  const address = verifiedPayload(token, secret, now, true)
  assertExpectedAddress(address, expected)
  return address
}

export function verifyFormattedLocationProof(token: string, expected: string, secret?: string, now = new Date()) {
  const address = verifiedPayload(token, secret, now)
  if (comparable(address.formattedAddress) !== comparable(expected)) throw new Error('location_proof_mismatch')
  return address
}

