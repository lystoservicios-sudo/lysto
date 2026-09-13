// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { currentRelease, redactLogValue } from '@/lib/observability/logger'
import { rateLimitKey } from '@/lib/security/rate-limit'
import {
  requireNewCheckouts,
  requireNewRequests,
  runtimeSwitches
} from '@/lib/release/runtime-switches'
import nextConfig from '../../next.config'

it('redacts credentials, cookies, email, phone and bearer values recursively', () => {
  const redacted = redactLogValue({
    email: 'persona@example.com',
    phone: '+54 11 5555 5555',
    cookie: 'sb=secret',
    nested: { authorization: 'Bearer abc', message: 'falló persona@example.com token=abcd' }
  })
  expect(JSON.stringify(redacted)).not.toMatch(/persona|5555|secret|Bearer abc|abcd/)
})

it('uses the explicit release when Vercel exposes an empty commit value', () => {
  expect(currentRelease({ VERCEL_GIT_COMMIT_SHA: '', LYSTO_RELEASE: 'ae5b181' })).toBe('ae5b181')
  expect(currentRelease({})).toBe('local')
})

it('creates a stable opaque distributed-rate-limit key', () => {
  const first = rateLimitKey('quote', '203.0.113.1', 'k'.repeat(32)),
    second = rateLimitKey('quote', '203.0.113.1', 'k'.repeat(32))
  expect(first).toBe(second)
  expect(first).toMatch(/^quote:[a-f0-9]{64}$/)
  expect(first).not.toContain('203.0.113.1')
})

describe('runtime switches', () => {
  it('can stop new requests independently from existing payment processing', () => {
    expect(
      runtimeSwitches({
        APP_ENV: 'production',
        PAYMENTS_PROVIDER: 'mercadopago_split',
        LYSTO_ACCEPT_NEW_REQUESTS: 'false',
        LYSTO_ALLOW_NEW_CHECKOUTS: 'true'
      })
    ).toMatchObject({ acceptNewRequests: false, allowNewCheckouts: true })
  })
  it('rejects mock payments and missing explicit switches in production', () => {
    expect(() =>
      runtimeSwitches({
        APP_ENV: 'production',
        PAYMENTS_PROVIDER: 'mock',
        LYSTO_ACCEPT_NEW_REQUESTS: 'true',
        LYSTO_ALLOW_NEW_CHECKOUTS: 'true'
      })
    ).toThrow(/mock/)
    expect(() =>
      runtimeSwitches({ APP_ENV: 'production', PAYMENTS_PROVIDER: 'mercadopago_split' })
    ).toThrow(/explicit/)
  })
  it('enforces each operational switch independently', () => {
    expect(() =>
      requireNewRequests({
        APP_ENV: 'staging',
        LYSTO_ACCEPT_NEW_REQUESTS: 'false',
        LYSTO_ALLOW_NEW_CHECKOUTS: 'true'
      })
    ).toThrow(/paused/)
    expect(() =>
      requireNewCheckouts({
        APP_ENV: 'staging',
        LYSTO_ACCEPT_NEW_REQUESTS: 'true',
        LYSTO_ALLOW_NEW_CHECKOUTS: 'false'
      })
    ).toThrow(/paused/)
  })
})

it('ships browser security headers with Mercado Pago compatibility', async () => {
  const entries = await nextConfig.headers!()
  const headers = Object.fromEntries(entries[0].headers.map(({ key, value }) => [key, value]))
  expect(headers['X-Content-Type-Options']).toBe('nosniff')
  expect(headers['X-Frame-Options']).toBe('DENY')
  expect(headers['Content-Security-Policy']).toContain('sdk.mercadopago.com')
  expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'")
  expect(headers['Content-Security-Policy']).not.toContain("'unsafe-eval'")
})

it('allows the Next development runtime to hydrate local browser tests', async () => {
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
  try {
    const entries = await nextConfig.headers!()
    const headers = Object.fromEntries(entries[0].headers.map(({ key, value }) => [key, value]))
    expect(headers['Content-Security-Policy']).toContain("'unsafe-eval'")
    expect(headers['Content-Security-Policy']).toContain('http://127.0.0.1:54321')
    expect(headers['Content-Security-Policy']).toContain('ws://127.0.0.1:54321')
  } finally {
    vi.unstubAllEnvs()
  }
})
