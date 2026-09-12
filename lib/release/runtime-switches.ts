import { z } from 'zod'
type Source = Record<string, string | undefined> | NodeJS.ProcessEnv
const bool = z.enum(['true', 'false']).transform((value) => value === 'true')
export function runtimeSwitches(env: Source = process.env) {
  const appEnv = z
    .enum(['development', 'test', 'staging', 'production'])
    .default('development')
    .parse(env.APP_ENV)
  if (appEnv === 'production' && env.PAYMENTS_PROVIDER !== 'mercadopago_split')
    throw new Error('mock_or_missing_payments_forbidden_in_production')
  if (appEnv === 'production' && (!env.LYSTO_ACCEPT_NEW_REQUESTS || !env.LYSTO_ALLOW_NEW_CHECKOUTS))
    throw new Error('production_switches_must_be_explicit')
  return {
    appEnv,
    acceptNewRequests: bool.parse(
      env.LYSTO_ACCEPT_NEW_REQUESTS ?? (appEnv === 'production' ? 'false' : 'true')
    ),
    allowNewCheckouts: bool.parse(
      env.LYSTO_ALLOW_NEW_CHECKOUTS ?? (appEnv === 'production' ? 'false' : 'true')
    )
  }
}
export function requireNewRequests(env: Source = process.env) {
  if (!runtimeSwitches(env).acceptNewRequests) throw new Error('new_requests_paused')
}
export function requireNewCheckouts(env: Source = process.env) {
  if (!runtimeSwitches(env).allowNewCheckouts) throw new Error('new_checkouts_paused')
}
