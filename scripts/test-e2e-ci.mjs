import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTestIdentity, assertTestEnvironment } from './lib/test-environment.mjs'
import { createTestServerEnvironment } from './lib/test-server-environment.mjs'

const require = createRequire(import.meta.url)
try {
  if (process.env.CI !== 'true' || process.argv.length !== 3) throw new Error('Explicit disposable CI workdir required')
  const workdir = resolve(process.argv[2])
  const env = { ...process.env, LYSTO_TEST_IDENTITY_FILE: resolve(workdir, 'DISPOSABLE.json') }
  const identity = readTestIdentity(env)
  if (identity.projectId !== 'lysto_integration_ci' || identity.production !== false) throw new Error('Unexpected CI database identity')
  Object.assign(env, { LYSTO_TEST_PROJECT_ID: identity.projectId, LYSTO_TEST_ENVIRONMENT: 'disposable', LYSTO_TEST_DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${identity.databasePort}/postgres`, LYSTO_TEST_SUPABASE_URL: `http://127.0.0.1:${identity.apiPort}`, LYSTO_TEST_ANON_KEY: 'preflight', LYSTO_TEST_SERVICE_ROLE_KEY: 'preflight', MERCADOPAGO_MODE: 'test' })
  assertTestEnvironment(env, identity)
  const status = JSON.parse(execFileSync(process.execPath, [require.resolve('supabase/dist/supabase.js'), 'status', '--output', 'json', '--workdir', workdir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
  Object.assign(env, { LYSTO_TEST_DATABASE_URL: status.DB_URL, LYSTO_TEST_SUPABASE_URL: status.API_URL, LYSTO_TEST_ANON_KEY: status.ANON_KEY, LYSTO_TEST_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY, LYSTO_E2E_BASE_URL: 'http://127.0.0.1:3100', LYSTO_E2E_PRODUCTION: '1' })
  const isolated = createTestServerEnvironment(env)
  mkdirSync('output/ci', { recursive: true })
  for (const listOnly of [true, false]) {
    const result = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', ...(listOnly ? ['--list'] : []), '--reporter=json'], { env: { ...isolated, PLAYWRIGHT_JSON_OUTPUT_NAME: resolve(`output/ci/e2e-${listOnly ? 'list' : 'result'}.json`) }, stdio: 'inherit' })
    if (result.status !== 0) throw new Error('CI E2E process failed; inspect the report')
  }
  const result = spawnSync(process.execPath, ['--experimental-strip-types', fileURLToPath(new URL('./lib/check-playwright-report.ts', import.meta.url)), 'output/ci/e2e-list.json', 'output/ci/e2e-result.json'], { stdio: 'inherit' })
  if (result.status !== 0) throw new Error('CI E2E acceptance failed')
} catch (error) {
  console.error(error instanceof Error && !('stderr' in error) ? error.message : 'Unable to read disposable CI Supabase status')
  process.exitCode = 1
}
