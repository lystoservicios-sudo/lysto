import { describe, expect, it } from 'vitest'
import { assertTestEnvironment } from '../../scripts/lib/test-environment.mjs'

const identity = { projectId: 'lysto_production_check', databasePort: 56322, apiPort: 56321, production: false }
const env = {
  LYSTO_TEST_PROJECT_ID: identity.projectId,
  LYSTO_TEST_ENVIRONMENT: 'disposable',
  LYSTO_TEST_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:56322/postgres',
  LYSTO_TEST_SUPABASE_URL: 'http://127.0.0.1:56321',
  LYSTO_TEST_ANON_KEY: 'local-key', LYSTO_TEST_SERVICE_ROLE_KEY: 'local-admin-key',
  MERCADOPAGO_MODE: 'test', PAYMENTS_PROVIDER: 'mercadopago_split'
}

const stagingIdentity = {
  environment: 'staging',
  production: false,
  origin: 'https://lysto-staging-preview.vercel.app',
  projectRef: 'obksyzasmfwcbbksesqt',
  databaseHost: 'aws-0-us-east-1.pooler.supabase.com',
  testResources: ['customer-synthetic', 'professional-synthetic', 'operator-synthetic']
}
const stagingEnv = {
  APP_ENV: 'staging',
  LYSTO_TEST_PROJECT_ID: stagingIdentity.projectRef,
  LYSTO_PRODUCTION_PROJECT_REF: 'dqonlqcurvjnjgsczevu',
  LYSTO_TEST_ENVIRONMENT: 'staging',
  LYSTO_TEST_DATABASE_URL:
    'postgresql://postgres.obksyzasmfwcbbksesqt:synthetic-password@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=no-verify',
  LYSTO_TEST_SUPABASE_URL: 'https://obksyzasmfwcbbksesqt.supabase.co',
  LYSTO_TEST_ANON_KEY: 'staging-key',
  LYSTO_TEST_SERVICE_ROLE_KEY: 'staging-admin-key',
  MERCADOPAGO_MODE: 'test'
}
describe('fixture environment guard', () => {
  it('accepts only the explicitly identified disposable project', () => {
    expect(assertTestEnvironment(env, identity).projectId).toBe(identity.projectId)
  })
  it.each(['https://production.supabase.co', 'http://127.0.0.1.evil.test:56321', 'http://user:pass@127.0.0.1:56321', 'http://127.0.0.1:55321'])('rejects unsafe API target %s', url => {
    expect(() => assertTestEnvironment({ ...env, LYSTO_TEST_SUPABASE_URL: url }, identity)).toThrow()
  })
  it('rejects the original database port and mismatched project', () => {
    expect(() => assertTestEnvironment({ ...env, LYSTO_TEST_DATABASE_URL: env.LYSTO_TEST_DATABASE_URL.replace('56322', '55322') }, identity)).toThrow()
    expect(() => assertTestEnvironment({ ...env, LYSTO_TEST_PROJECT_ID: 'lysto' }, identity)).toThrow()
  })
  it('rejects missing variables, identity and production markers', () => {
    expect(() => assertTestEnvironment({}, identity)).toThrow()
    expect(() => assertTestEnvironment(env, undefined)).toThrow()
    expect(() => assertTestEnvironment(env, { ...identity, production: true })).toThrow()
  })
  it('rejects live payments even with local database', () => {
    expect(() => assertTestEnvironment({ ...env, MERCADOPAGO_MODE: 'live' }, identity)).toThrow()
  })
  it('accepts an explicitly identified remote staging project', () => {
    expect(assertTestEnvironment(stagingEnv, stagingIdentity)).toEqual({
      projectId: stagingIdentity.projectRef,
      apiUrl: stagingEnv.LYSTO_TEST_SUPABASE_URL,
      databaseUrl: stagingEnv.LYSTO_TEST_DATABASE_URL
    })
  })
  it.each([
    { LYSTO_TEST_PROJECT_ID: 'dqonlqcurvjnjgsczevu' },
    { LYSTO_TEST_SUPABASE_URL: 'https://dqonlqcurvjnjgsczevu.supabase.co' },
    { LYSTO_TEST_DATABASE_URL: stagingEnv.LYSTO_TEST_DATABASE_URL.replace(':5432/', ':6543/') },
    { LYSTO_TEST_DATABASE_URL: stagingEnv.LYSTO_TEST_DATABASE_URL.replace('aws-0-us-east-1.pooler.supabase.com', 'evil.example.com') },
    { APP_ENV: 'production' },
    { MERCADOPAGO_MODE: 'live' }
  ])('rejects a staging fixture target with unsafe override %#', override => {
    expect(() => assertTestEnvironment({ ...stagingEnv, ...override }, stagingIdentity)).toThrow()
  })
  it('rejects a production project even when its identity is falsely labelled staging', () => {
    const projectRef = stagingEnv.LYSTO_PRODUCTION_PROJECT_REF
    expect(() =>
      assertTestEnvironment(
        {
          ...stagingEnv,
          LYSTO_TEST_PROJECT_ID: projectRef,
          LYSTO_TEST_SUPABASE_URL: `https://${projectRef}.supabase.co`,
          LYSTO_TEST_DATABASE_URL: stagingEnv.LYSTO_TEST_DATABASE_URL.replaceAll(
            stagingIdentity.projectRef,
            projectRef
          )
        },
        { ...stagingIdentity, projectRef }
      )
    ).toThrow()
  })
})
