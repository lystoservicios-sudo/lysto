import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const projects = new Map([
  ['lysto_production_check', { databasePort: 56322, apiPort: 56321 }],
  ['lysto_integration_ci', { databasePort: 54322, apiPort: 54321 }]
])

export function assertTestEnvironment(env, identity) {
  const fail = () => { throw new Error('Integration tests require an explicitly identified disposable local environment') }
  const expected = projects.get(env.LYSTO_TEST_PROJECT_ID)
  if (!identity || identity.production !== false || !expected || identity.projectId !== env.LYSTO_TEST_PROJECT_ID || env.LYSTO_TEST_ENVIRONMENT !== 'disposable') fail()
  if (identity.databasePort !== expected.databasePort || identity.apiPort !== expected.apiPort) fail()
  if (!env.LYSTO_TEST_ANON_KEY || !env.LYSTO_TEST_SERVICE_ROLE_KEY || env.MERCADOPAGO_MODE !== 'test') fail()
  let api, database
  try { api = new URL(env.LYSTO_TEST_SUPABASE_URL); database = new URL(env.LYSTO_TEST_DATABASE_URL) } catch { fail() }
  if (!['localhost', '127.0.0.1'].includes(api.hostname) || api.protocol !== 'http:' || api.port !== String(expected.apiPort) || api.username || api.password || api.search || api.hash || api.pathname !== '/') fail()
  if (!['localhost', '127.0.0.1'].includes(database.hostname) || !['postgres:', 'postgresql:'].includes(database.protocol) || database.port !== String(expected.databasePort) || database.pathname !== '/postgres' || database.search || database.hash) fail()
  return { projectId: identity.projectId, apiUrl: api.origin, databaseUrl: database.toString() }
}

export function readTestIdentity(env) {
  if (!env.LYSTO_TEST_IDENTITY_FILE) throw new Error('LYSTO_TEST_IDENTITY_FILE is required')
  const identity = JSON.parse(readFileSync(env.LYSTO_TEST_IDENTITY_FILE, 'utf8'))
  const config = readFileSync(join(dirname(env.LYSTO_TEST_IDENTITY_FILE), 'supabase', 'config.toml'), 'utf8')
  const sectionPort = section => Number(config.split(/\r?\n(?=\[)/).find(part => part.startsWith(`[${section}]`))?.match(/^port\s*=\s*(\d+)/m)?.[1])
  if (config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1] !== identity.projectId || sectionPort('db') !== identity.databasePort || sectionPort('api') !== identity.apiPort) throw new Error('Disposable marker does not match Supabase configuration')
  return identity
}
