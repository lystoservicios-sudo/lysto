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
  return `v1.${expiration}.${signature(checkoutId, expiration, key)}`
}

export function checkPaymentReturnToken(checkoutId: string, token: string, key: string, now = Date.now()) {
  if (!uuid.safeParse(checkoutId).success || token.length > 100) return false
  const match = /^v1\.(\d{10})\.([a-f0-9]{64})$/.exec(token)
  if (!match || Number(match[1]) * 1000 <= now) return false
  return timingSafeEqual(
    Buffer.from(match[2], 'hex'),
    Buffer.from(signature(checkoutId, Number(match[1]), key), 'hex')
  )
}
