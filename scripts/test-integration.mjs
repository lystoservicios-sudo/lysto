import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { assertTestEnvironment, readTestIdentity } from './lib/test-environment.mjs'
import { verifyIntegrationReport } from './lib/integration-report.mjs'

const require = createRequire(import.meta.url)
try {
  const args = process.argv.slice(2).filter(arg => arg !== '--')
  const env = { ...process.env }
  const local = args.indexOf('--local-workdir')
  if (local !== -1) {
    const workdir = args[local + 1]
    if (!workdir || workdir.startsWith('-')) throw new Error('Explicit local workdir is required')
    args.splice(local, 2)
    env.LYSTO_TEST_IDENTITY_FILE = resolve(workdir, 'DISPOSABLE.json')
    const identity = readTestIdentity(env)
    Object.assign(env, {
      LYSTO_TEST_PROJECT_ID: identity.projectId, LYSTO_TEST_ENVIRONMENT: 'disposable',
      LYSTO_TEST_DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${identity.databasePort}/postgres`,
      LYSTO_TEST_SUPABASE_URL: `http://127.0.0.1:${identity.apiPort}`,
      LYSTO_TEST_ANON_KEY: 'preflight', LYSTO_TEST_SERVICE_ROLE_KEY: 'preflight', MERCADOPAGO_MODE: 'test'
    })
    assertTestEnvironment(env, identity)
    const stdout = execFileSync(process.execPath, [require.resolve('supabase/dist/supabase.js'), 'status', '--output', 'json', '--workdir', workdir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    const status = JSON.parse(stdout)
    Object.assign(env, { LYSTO_TEST_DATABASE_URL: status.DB_URL, LYSTO_TEST_SUPABASE_URL: status.API_URL, LYSTO_TEST_ANON_KEY: status.ANON_KEY, LYSTO_TEST_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY })
  }
  const target = assertTestEnvironment(env, readTestIdentity(env))
  // A local test invocation must not inherit usable provider/remote credentials.
  for (const key of Object.keys(env)) if (key.startsWith('MERCADOPAGO_') && key !== 'MERCADOPAGO_MODE') delete env[key]
  Object.assign(env, { NEXT_PUBLIC_SUPABASE_URL: target.apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: env.LYSTO_TEST_ANON_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.LYSTO_TEST_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: env.LYSTO_TEST_SERVICE_ROLE_KEY, APP_ENV: 'test' })
  if (args.some(arg => arg.startsWith('-'))) throw new Error('Only test-name filters are accepted; runner safety settings cannot be overridden')
  const output = resolve('output', 'integration', randomUUID())
  mkdirSync(output, { recursive: true })
  const reportPath = join(output, 'result.json')
  console.log(`Integration target: ${target.projectId}; isolated local Auth/PostgreSQL; provider mode test`)
  const result = spawnSync(process.execPath, [require.resolve('vitest/vitest.mjs'), 'run', '--config', 'vitest.integration.config.ts', ...args, '--reporter=default', '--reporter=json', `--outputFile.json=${reportPath}`], { env, stdio: 'inherit' })
  if (result.error || result.status !== 0) throw new Error('Integration process failed; inspect test output')
  const report = JSON.parse(readFileSync(reportPath, 'utf8'))
  const passed = verifyIntegrationReport(report, args.length > 0)
  console.log(`${args.length ? 'Filtered integration check' : 'Full mandatory integration acceptance'} passed: ${passed} tests; zero skipped`)
} catch (error) {
  // Never print CLI stdout/stderr or environment: local status contains keys.
  console.error(error instanceof Error && !('stderr' in error) ? error.message : 'Unable to read the disposable Supabase status')
  process.exitCode = 1
}
