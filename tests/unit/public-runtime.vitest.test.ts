import { describe, expect, it } from 'vitest'
import { requireNewCheckouts, requireNewRequests, runtimeSwitches } from '../../lib/release/runtime-switches'

describe('public production runtime', () => {
  const env = { APP_ENV: 'production', PAYMENTS_PROVIDER: 'disabled', LYSTO_ACCEPT_NEW_REQUESTS: 'false', LYSTO_ALLOW_NEW_CHECKOUTS: 'false' }
  it('serves the public website while rejecting new service orders and payments', () => {
    expect(runtimeSwitches(env)).toEqual({ appEnv: 'production', acceptNewRequests: false, allowNewCheckouts: false })
    expect(() => requireNewRequests(env)).toThrow('new_requests_paused')
    expect(() => requireNewCheckouts(env)).toThrow('new_checkouts_paused')
  })
  it('cannot enable intake or checkout with payments disabled', () => {
    expect(() => runtimeSwitches({ ...env, LYSTO_ACCEPT_NEW_REQUESTS: 'true' })).toThrow()
    expect(() => runtimeSwitches({ ...env, LYSTO_ALLOW_NEW_CHECKOUTS: 'true' })).toThrow()
    expect(() => runtimeSwitches({ ...env, PAYMENTS_PROVIDER: 'mock' })).toThrow()
  })
})
