import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

const uuid = z.string().uuid()
const returnWindowMs = 7 * 24 * 60 * 60 * 1000
function signature(checkoutId: string, expiration: number, key: string) {
  const bytes = Buffer.from(key, 'base64')
  if (bytes.length !== 32) throw new Error('payments_not_configured')
  // Separate purpose from encryption, OAuth binding and webhook authentication.
  return createHmac('sha256', bytes)
    .update(`lysto-payment-return-v1:${checkoutId}:${expiration}`).digest('hex')
}

/** A limited receipt capability, never an account/session or payment authority. */
export function issuePaymentReturnToken(checkoutId: string, key: string, checkoutExpiresAt: Date) {
  uuid.parse(checkoutId)
  const expiration = Math.floor((checkoutExpiresAt.getTime() + returnWindowMs) / 1000)
  if (!Number.isSafeInteger(expiration)) throw new Error('invalid_payment_expiry')
  return `v2.${expiration}.${Buffer.from(signature(checkoutId, expiration, key), 'hex').toString('base64url')}`
}

export function checkPaymentReturnToken(checkoutId: string, token: string, key: string, now = Date.now()) {
  if (!uuid.safeParse(checkoutId).success || token.length > 100) return false
  const match = /^(v1|v2)\.(\d{10})\.([a-f0-9]{64}|[A-Za-z0-9_-]{43})$/.exec(token)
  if (!match || Number(match[2]) * 1000 <= now) return false
  const bytes = Buffer.from(match[3], match[1] === 'v1' ? 'hex' : 'base64url')
  if (bytes.length !== 32 || bytes.toString(match[1] === 'v1' ? 'hex' : 'base64url') !== match[3]) return false
  return timingSafeEqual(
    bytes,
    Buffer.from(signature(checkoutId, Number(match[2]), key), 'hex')
  )
}

/** Re-encode an existing valid capability without changing its expiration or authority. */
export function compactPaymentReturnToken(checkoutId: string, token: string, key: string) {
  if (!checkPaymentReturnToken(checkoutId, token, key)) throw new Error('invalid_return_token')
  if (token.startsWith('v2.')) return token
  const [, expiration, digest] = token.split('.')
  return `v2.${expiration}.${Buffer.from(digest, 'hex').toString('base64url')}`
}
