// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRecoveryContinuation, readRecoveryContinuation } from '../../lib/auth/recovery-continuation'

beforeEach(() => vi.stubEnv('RATE_LIMIT_HASH_KEY', 'disposable-recovery-signing-key-at-least-32-characters'))
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

it('authenticates the recovery identity and rejects a changed user or session payload', () => {
  const grant = createRecoveryContinuation('user', 'session')
  expect(readRecoveryContinuation(grant)).toMatchObject({ userId: 'user', sessionId: 'session' })
  const [, signature] = grant.split('.')
  const forged = Buffer.from(JSON.stringify({ userId: 'other', sessionId: 'other', expires: Date.now() + 600_000 })).toString('base64url')
  expect(readRecoveryContinuation(`${forged}.${signature}`)).toBeNull()
  expect(readRecoveryContinuation(`${grant}.extra`)).toBeNull()
})
it('expires after ten minutes and fails closed without the server secret', () => {
  vi.useFakeTimers()
  const grant = createRecoveryContinuation('user', 'session')
  vi.advanceTimersByTime(600_000)
  expect(readRecoveryContinuation(grant)).toBeNull()
  vi.stubEnv('RATE_LIMIT_HASH_KEY', '')
  expect(() => createRecoveryContinuation('user', 'session')).toThrow()
})
