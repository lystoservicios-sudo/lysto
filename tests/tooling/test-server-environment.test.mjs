import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as environment from '../../scripts/lib/test-server-environment.mjs'
import { parsePublicEnv } from '../../lib/config/env.ts'

function setup() {
  const cwd = mkdtempSync(join(tmpdir(), 'lysto-test-server-'))
  mkdirSync(join(cwd, 'supabase'))
  writeFileSync(join(cwd, 'DISPOSABLE.json'), JSON.stringify({ projectId: 'lysto_production_check', production: false, databasePort: 56322, apiPort: 56321 }))
  writeFileSync(join(cwd, 'supabase/config.toml'), 'project_id = "lysto_production_check"\n[api]\nport = 56321\n[db]\nport = 56322\n')
  const env = { LYSTO_TEST_IDENTITY_FILE: join(cwd, 'DISPOSABLE.json'), LYSTO_TEST_PROJECT_ID: 'lysto_production_check', LYSTO_TEST_ENVIRONMENT: 'disposable', LYSTO_TEST_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:56322/postgres', LYSTO_TEST_SUPABASE_URL: 'http://127.0.0.1:56321', LYSTO_TEST_ANON_KEY: 'test-anon', LYSTO_TEST_SERVICE_ROLE_KEY: 'test-service', MERCADOPAGO_MODE: 'test' }
  return { cwd, env, cleanup: () => rmSync(cwd, { recursive: true, force: true }) }
}

test('test server requires an explicit disposable backend before Next starts', () => {
  const fixture = setup()
  try {
    assert.throws(() => environment.createTestServerEnvironment({}, fixture.cwd))
    assert.throws(() => environment.createTestServerEnvironment({ ...fixture.env, LYSTO_TEST_SUPABASE_URL: 'https://remote.supabase.co' }, fixture.cwd))
    assert.throws(() => environment.createTestServerEnvironment({ ...fixture.env, MERCADOPAGO_MODE: 'live' }, fixture.cwd))
  } finally { fixture.cleanup() }
})

test('test server replaces remote credentials and removes provider secrets', () => {
  const fixture = setup()
  try {
    const actual = environment.createTestServerEnvironment({ ...fixture.env, NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3100', NEXT_PUBLIC_SUPABASE_URL: 'https://remote.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'remote-public-key', SUPABASE_SERVICE_ROLE_KEY: 'remote-secret', MERCADOPAGO_ACCESS_TOKEN: 'provider-secret', MERCADOPAGO_DATABASE_URL: 'postgresql://remote/db' }, fixture.cwd)
    assert.equal(actual.NEXT_PUBLIC_SUPABASE_URL, fixture.env.LYSTO_TEST_SUPABASE_URL)
    assert.equal(actual.SUPABASE_SERVICE_ROLE_KEY, 'test-service')
    assert.equal(parsePublicEnv(actual).supabasePublishableKey, 'test-anon')
    assert.equal(actual.MERCADOPAGO_DATABASE_URL, fixture.env.LYSTO_TEST_DATABASE_URL)
    assert.equal(actual.MERCADOPAGO_ACCESS_TOKEN, undefined)
    assert.equal(actual.APP_ENV, 'test')
  } finally { fixture.cleanup() }
})

test('Next dotenv files cannot reintroduce remote configuration', () => {
  for (const file of ['.env', '.env.local', '.env.production', '.env.production.local', '.env.development', '.env.development.local', '.env.test', '.env.test.local']) {
    const fixture = setup()
    try {
      writeFileSync(join(fixture.cwd, file), 'MERCADOPAGO_ACCESS_TOKEN=remote-secret\n')
      assert.throws(() => environment.createTestServerEnvironment(fixture.env, fixture.cwd), /dotenv/i)
    } finally { fixture.cleanup() }
  }
})

test('quote integration cannot inherit a billable routing credential', () => {
  const fixture = setup()
  try {
    const actual = environment.createTestServerEnvironment({ ...fixture.env, GOOGLE_MAPS_SERVER_API_KEY: 'billable-provider-secret' }, fixture.cwd)
    assert.equal(actual.GOOGLE_MAPS_SERVER_API_KEY, undefined)
  } finally { fixture.cleanup() }
})
