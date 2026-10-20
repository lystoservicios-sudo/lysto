// @vitest-environment node
import { expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { issuePaymentReturnToken, checkPaymentReturnToken } from '@/lib/payments/payment-return-token'
const id = '92000000-0000-4000-8000-000000000001'
const other = '92000000-0000-4000-8000-000000000002'
const key = Buffer.alloc(32, 42).toString('base64')
const now = Date.parse('2026-10-20T18:00:00Z')

it('authorizes only the paid checkout during the bounded return window', () => {
  const token = issuePaymentReturnToken(id, key, new Date(now + 1800000))
  expect(checkPaymentReturnToken(id, token, key, now)).toBe(true)
  expect(checkPaymentReturnToken(other, token, key, now)).toBe(false)
  expect(checkPaymentReturnToken(id, token, key, now + 8 * 86400000)).toBe(false)
})
it('rejects forged, malformed and differently signed tokens', () => {
  const token = issuePaymentReturnToken(id, key, new Date(now))
  for (const forged of ['', 'approved', token.slice(0, -1), `v1.9999999999.${'0'.repeat(64)}`]) {
    expect(checkPaymentReturnToken(id, forged, key, now)).toBe(false)
  }
  expect(checkPaymentReturnToken(id, token, Buffer.alloc(32, 1).toString('base64'), now)).toBe(false)
})
it('retains the full 256-bit signature in compact tokens and verifies previously issued links', () => {
  const expires = new Date(now + 1800000)
  const expiration = Math.floor((expires.getTime() + 7 * 86400000) / 1000)
  const digest = createHmac('sha256', Buffer.from(key, 'base64'))
    .update(`lysto-payment-return-v1:${id}:${expiration}`).digest('hex')
  const legacy = `v1.${expiration}.${digest}`
  const token = issuePaymentReturnToken(id, key, expires)
  expect(token).toBe(`v2.${expiration}.${Buffer.from(digest, 'hex').toString('base64url')}`)
  expect(checkPaymentReturnToken(id, legacy, key, now)).toBe(true)
  expect(checkPaymentReturnToken(other, legacy, key, now)).toBe(false)
  expect(checkPaymentReturnToken(id, legacy, key, now + 8 * 86400000)).toBe(false)
})
