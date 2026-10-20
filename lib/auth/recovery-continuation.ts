import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

const grantSchema = z.object({ userId: z.string().min(1), sessionId: z.string().min(1), expires: z.number().int() })

function signature(payload: string) {
  const secret = process.env.RATE_LIMIT_HASH_KEY
  if (!secret || secret.length < 32) throw new Error('Recovery signing key unavailable')
  // Domain separation from rate-limit identifiers that use the same server secret.
  return createHmac('sha256', secret).update('lysto:password-recovery:v1:').update(payload).digest()
}

/** Issued only after verifyOtp succeeds; never contains a password or provider token. */
export function createRecoveryContinuation(userId: string, sessionId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, sessionId, expires: Date.now() + 600_000 })).toString('base64url')
  return `${payload}.${signature(payload).toString('base64url')}`
}

export function readRecoveryContinuation(value: string) {
  if (value.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return null
  const [payload, supplied] = value.split('.')
  const expected = signature(payload)
  const actual = Buffer.from(supplied, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  try {
    const grant = grantSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString()))
    return grant.expires > Date.now() ? grant : null
  } catch { return null }
}
