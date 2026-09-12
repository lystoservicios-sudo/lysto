import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertTestEnvironment, readTestIdentity } from './test-environment.mjs'

/** Validate before Next loads dotenv files or evaluates server components. */
export function createTestServerEnvironment(env, cwd = process.cwd()) {
  const target = assertTestEnvironment(env, readTestIdentity(env))
  for (const file of ['.env', '.env.local', '.env.production', '.env.production.local', '.env.development', '.env.development.local', '.env.test', '.env.test.local']) {
    if (existsSync(resolve(cwd, file))) throw new Error('Test server requires a checkout without dotenv files; use the explicit disposable environment')
  }
  const isolated = { ...env }
  for (const key of Object.keys(isolated)) if (key.startsWith('MERCADOPAGO_')) delete isolated[key]
  delete isolated.GOOGLE_MAPS_SERVER_API_KEY
  delete isolated.RESEND_API_KEY
  delete isolated.NOTIFICATIONS_EMAIL_FROM
  delete isolated.OUTBOX_WORKER_SECRET
  delete isolated.REFUND_WORKER_SECRET
  delete isolated.RATE_LIMIT_HASH_KEY
  isolated.OUTBOX_WORKER_ENABLED = 'false'
  isolated.REFUND_WORKER_ENABLED = 'false'
  isolated.NOTIFICATIONS_EMAIL_ENABLED = 'false'
  return { ...isolated, APP_ENV: 'test', MERCADOPAGO_MODE: 'test', MERCADOPAGO_DATABASE_URL: target.databaseUrl,
    NEXT_PUBLIC_SUPABASE_URL: target.apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: env.LYSTO_TEST_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.LYSTO_TEST_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.LYSTO_TEST_SERVICE_ROLE_KEY,
    RATE_LIMIT_HASH_KEY: 'lysto-disposable-test-rate-limit-key' }
}
