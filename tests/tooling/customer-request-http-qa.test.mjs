import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const qaRunner = await import('../../scripts/test-customer-request-http-qa.mjs').catch(() => ({}))
const ref = 'obksyzasmfwcbbksesqt'
const origin = 'http://127.0.0.1:3187'
const token = (role, projectRef = ref, exp = Math.floor(Date.now() / 1000) + 3600) => [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ role, ref: projectRef, exp, iss: 'supabase' })).toString('base64url'), 'unit-fixture-signature'
].join('.')
function api(name) { assert.equal(typeof qaRunner[name], 'function', `Inert QA runner must implement ${name}`); return qaRunner[name] }
const keys = () => ({ anon: token('anon'), service: token('service_role') })
const baseline = () => ({ migrationCount: 79, lastMigration: '20261014235503',
  versions: ['20261004011254', '20261013141601', '20261014023946', '20261014213321', '20261014235503'], writerRoleExists: false,
  quotePolicyId: null, requestPolicyEnabled: false,
  counts: { ...Object.fromEntries(['auth.users', 'auth.sessions', 'auth.identities', 'auth.refresh_tokens', 'public.profiles', 'public.customer_profiles',
    'public.customer_homes', 'public.customer_home_floors', 'public.customer_home_rooms', 'public.customer_equipment', 'public.customer_addresses',
    'public.customer_home_addresses', 'public.customer_equipment_placements', 'private.customer_home_operations', 'private.customer_registration_acceptances', 'private.policy_acceptances',
    'public.jobs', 'public.service_requests', 'public.service_quotes', 'public.marketplace_checkouts', 'public.payments',
    'private.customer_request_previews', 'private.customer_request_contracts', 'private.outbox_events', 'public.admin_audit_logs'].map(name => [name, 0])),
    'private.rate_limit_buckets': 412 }, rateFingerprint: '72f3c806dda6d3dda0a139eb5cc2458b',
  policyFingerprint: 'a'.repeat(32), permissionsFingerprint: 'b'.repeat(32) })

test('QA HTTP smoke is inert by default and no external operation is called', async () => {
  const run = api('main')
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('Network forbidden in local tooling test') }
  try {
    const result = await run([])
    assert.equal(result.mode, 'dry-run'); assert.equal(result.projectRef, ref); assert.equal(calls, 0)
    assert.match(JSON.stringify(result), /partial.*HTTP/i)
  } finally { globalThis.fetch = original }
})

test('execution requires exact QA ref and explicit loopback origin, rejecting production and overrides', () => {
  const parse = api('parseQaArguments')
  assert.equal(parse([]).mode, 'dry-run')
  assert.equal(parse(['--execute', '--qa-ref', ref, '--origin', origin]).mode, 'execute')
  for (const args of [ ['--execute'], ['--execute', '--qa-ref', 'dqonlqcurvjnjgsczevu', '--origin', origin],
    ['--execute', '--qa-ref', ref, '--origin', 'https://example.com'], ['--execute', '--qa-ref', ref, '--origin', origin, '--db-url', 'postgres://anything'],
    ['--execute', '--qa-ref', ref, '--origin', 'http://localhost:3187'], ['--execute', '--qa-ref', ref, '--origin', `${origin}/other`]])
    assert.throws(() => parse(args))
})

test('QA key validation refuses wrong refs, roles, expiry and secret-key aliases in public slots', () => {
  const validate = api('assertQaKeys')
  assert.deepEqual(validate(keys()), keys())
  for (const pair of [{ anon: token('service_role'), service: token('service_role') }, { anon: token('anon'), service: token('anon') },
    { anon: token('anon', 'dqonlqcurvjnjgsczevu'), service: token('service_role') },
    { anon: token('anon', ref, 1), service: token('service_role') }, { anon: 'sb_secret_unit', service: token('service_role') }])
    assert.throws(() => validate(pair))
})

test('Next child environment is an allowlist with only QA credentials and no PostgreSQL/provider credentials', () => {
  const create = api('createQaChildEnvironment')
  const parent = { PATH: 'tool-path', SystemRoot: 'C:/Windows', NODE_OPTIONS: '--require secret-hook',
    NEXT_PUBLIC_SUPABASE_URL: 'https://dqonlqcurvjnjgsczevu.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'production-secret',
    MERCADOPAGO_DATABASE_URL: 'postgres://production', GOOGLE_MAPS_SERVER_API_KEY: 'billable', RESEND_API_KEY: 'mail',
    OUTBOX_WORKER_SECRET: 'worker', REFUND_WORKER_SECRET: 'refund', UNKNOWN_SECRET: 'secret' }
  const pair = keys(), child = create({ origin, keys: pair, parent })
  assert.equal(child.NEXT_PUBLIC_SUPABASE_URL, `https://${ref}.supabase.co`)
  assert.equal(child.SUPABASE_SERVICE_ROLE_KEY, pair.service)
  assert.equal(child.NEXT_PUBLIC_SUPABASE_ANON_KEY, pair.anon)
  assert.equal(child.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, pair.anon)
  assert.equal(child.APP_ENV, 'test'); assert.equal(child.PAYMENTS_PROVIDER, 'mock')
  assert.equal(child.LYSTO_ALLOW_NEW_CHECKOUTS, 'false'); assert.equal(child.LYSTO_ACCEPT_NEW_REQUESTS, 'true')
  assert.equal(child.LYSTO_BUILD_DIR, '.next-pedir-http-qa')
  for (const name of ['NODE_OPTIONS', 'MERCADOPAGO_DATABASE_URL', 'GOOGLE_MAPS_SERVER_API_KEY', 'RESEND_API_KEY',
    'OUTBOX_WORKER_SECRET', 'REFUND_WORKER_SECRET', 'UNKNOWN_SECRET', 'LYSTO_TEST_DATABASE_URL']) assert.equal(child[name], undefined)
  for (const name of ['OUTBOX_WORKER_ENABLED', 'REFUND_WORKER_ENABLED', 'NOTIFICATIONS_EMAIL_ENABLED', 'AI_ENABLED', 'WHATSAPP_ENABLED']) assert.equal(child[name], 'false')
})

test('all loaded dotenv variants are refused before Next can start', () => {
  const guard = api('assertNoQaDotenv')
  assert.doesNotThrow(() => guard(['.env.example', 'package.json']))
  for (const file of ['.env', '.env.local', '.env.development', '.env.development.local', '.env.test', '.env.test.local', '.env.production', '.env.production.local'])
    assert.throws(() => guard([file]), /dotenv/)
})

test('read-only preflight pins migration history, empty app identities and no invented writer role', () => {
  const guard = api('assertQaBaseline')
  assert.doesNotThrow(() => guard(baseline()))
  for (const state of [{ ...baseline(), migrationCount: 78 }, { ...baseline(), migrationCount: 80 }, { ...baseline(), lastMigration: '20261014213321' },
    { ...baseline(), versions: baseline().versions.filter(version => version !== '20261014235503') },
    { ...baseline(), versions: [] }, { ...baseline(), writerRoleExists: true },
    { ...baseline(), counts: { ...baseline().counts, 'auth.users': 1 } }, { ...baseline(), counts: {} }]) assert.throws(() => guard(state))
})

test('manifest stores only exact owned UUIDs, phases, hashes and rate keys, never credentials', () => {
  const serialize = api('publicManifest')
  const state = { runId: '10000000-0000-4000-8000-000000000001', phase: 'fixtures-created', projectRef: ref,
    actors: [{ authId: '10000000-0000-4000-8000-000000000002', profileId: '10000000-0000-4000-8000-000000000003',
      customerId: '10000000-0000-4000-8000-000000000004', password: 'password', cookie: 'cookie', accessToken: token('authenticated') }],
    keys: keys(), baseline: baseline(), unknown: 'secret', rateKeys: [`private_mutation:${'a'.repeat(64)}`], uncertain: [] }
  const output = JSON.stringify(serialize(state))
  for (const text of ['password', 'cookie', 'accessToken', 'unit-fixture-signature', 'secret']) assert.equal(output.includes(text), false)
  assert.equal(JSON.parse(output).actors[0].authId, state.actors[0].authId)
  assert.throws(() => serialize({ ...state, phase: 'secret-bearing-error-body' }))
})

test('cleanup SQL can target only a bounded set of exact owned rate keys; identity deletion remains Auth API', () => {
  const cleanup = api('ownedRateCleanupSql')
  const key = `private_mutation:${'a'.repeat(64)}`
  const sql = cleanup([key])
  assert.match(sql, /delete from private\.rate_limit_buckets where key = any/i)
  assert.match(sql, new RegExp(key)); assert.doesNotMatch(sql, /truncate|delete from auth|delete from public|prune/i)
  assert.throws(() => cleanup(['anything'])); assert.throws(() => cleanup([`${key}';delete from auth.users;--`]))
  assert.throws(() => cleanup(Array.from({ length: 3 }, (_, i) => `private_mutation:${String(i).repeat(64)}`)))
})

test('HTTP transport fails closed for any endpoint beyond exact QA or its loopback app', async () => {
  const transport = api('boundedQaFetch')
  let calls = 0
  const fetcher = async () => { calls++; return new Response('{}', { status: 200 }) }
  const fetch = transport({ origin, fetcher })
  assert.equal((await fetch(`https://${ref}.supabase.co/auth/v1/settings`)).status, 200)
  assert.equal((await fetch(`${origin}/api/health/live`)).status, 200)
  for (const url of ['https://dqonlqcurvjnjgsczevu.supabase.co/auth/v1/settings', 'https://api.mercadopago.com/v1/payments',
    `${origin}/api/mercadopago/create-preference`, 'http://127.0.0.1:3188/api/health/live']) await assert.rejects(fetch(url))
  assert.equal(calls, 2)
})

test('before/after comparison requires zero owned fixture residue and unchanged policies and permissions', () => {
  const compare = api('assertQaRestored'), before = baseline()
  assert.doesNotThrow(() => compare(before, baseline(), []))
  for (const after of [{ ...baseline(), permissionsFingerprint: 'changed' }, { ...baseline(), policyFingerprint: 'changed' },
    { ...baseline(), counts: { ...baseline().counts, 'private.customer_registration_acceptances': 1 } }]) assert.throws(() => compare(before, after, []))
  assert.throws(() => compare(before, baseline(), ['uncertain-auth-create']))
})

test('Auth creation accepts the actual owned returned UUID and the manifest retains a deterministic recovery email', () => {
  const accept = api('acceptCreatedQaActor')
  const runId = '10000000-0000-4000-8000-000000000001', actualId = '10000000-0000-4000-8000-000000000002'
  const actor = { runId, email: `pedir-http-${runId}-0@lysto.invalid`, password: 'never-log-this' }
  accept(actor, { user: { id: actualId, email: actor.email, app_metadata: { app_role: 'customer', signup_source: 'qa_pedir_http', qa_pedir_http_run: runId } } })
  assert.equal(actor.authId, actualId)
  const recorded = api('publicManifest')({ runId, projectRef: ref, phase: 'preflight', actors: [actor], rateKeys: [], uncertain: [] })
  assert.equal(recorded.actors[0].email, actor.email)
  assert.equal(JSON.stringify(recorded).includes(actor.password), false)
  assert.throws(() => accept({ ...actor }, { user: { id: actualId, email: 'someone@real.example', app_metadata: {} } }))
})

test('readiness failure retains the owned process and failed stopping forbids cleanup', async () => {
  const start = api('startOwnedQaApp'), quiesce = api('quiesceBeforeQaCleanup')
  let retained, stops = 0
  const owner = { pid: 123, stop: async () => { stops++; throw new Error('owned process still alive') } }
  await assert.rejects(start({ spawnOwned: () => owner, retain: value => { retained = value }, waitReady: async () => { throw new Error('readiness failed') } }))
  assert.equal(retained, owner)
  const state = { app: retained, uncertain: [] }
  assert.equal(await quiesce(state), false)
  assert.equal(stops, 1)
  assert.deepEqual(state.uncertain, ['server-stop'])
})

test('unknown Auth or application mutation outcome never automatically authorizes identity cleanup', async () => {
  const quiesce = api('quiesceBeforeQaCleanup')
  for (const uncertain of [['auth-create'], ['app-mutation']]) {
    let stopped = false
    assert.equal(await quiesce({ uncertain, app: { stop: async () => { stopped = true } } }), false)
    assert.equal(stopped, true)
  }
})

test('a returned signOut error requires real zero-session evidence before any identity deletion', async () => {
  const revoke = api('verifyQaSessionRevocation')
  let calls = 0
  const actor = { authId: '10000000-0000-4000-8000-000000000002', logoutAccessToken: 'unit-test-only-token' }
  const signOut = async () => { calls++; return { data: null, error: new Error('logout failed') } }
  await assert.rejects(revoke([actor], async () => 1, signOut))
  await assert.rejects(revoke([actor], async () => { throw new Error('session evidence unavailable') }, signOut))
  await assert.doesNotReject(revoke([actor], async () => 0, signOut))
  assert.equal(calls, 3)
})

test('the unavailable preview follows the real SQL producer: missing tariff is checked before missing initial scope', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20261014023946_customer_request_contract_checkout.sql', import.meta.url), 'utf8')
  const tariff = sql.indexOf("then v_reason:='tariffs_unapproved'")
  const scope = sql.indexOf("then v_reason:='initial_scope_unavailable'")
  assert.ok(tariff >= 0 && scope > tariff)
  const verify = api('assertUnavailableQaPreview')
  assert.doesNotThrow(() => verify({ status: 'needs_review', reason: 'tariffs_unapproved' }, baseline()))
  assert.throws(() => verify({ status: 'needs_review', reason: 'initial_scope_unavailable' }, baseline()))
  assert.throws(() => verify({ status: 'ready', quote: { total: 1000 } }, baseline()))
})

test('key retrieval reveals only in RAM and permission evidence includes owners and row policies', () => {
  const source = readFileSync(new URL('../../scripts/test-customer-request-http-qa.mjs', import.meta.url), 'utf8')
  assert.match(source, /cli\(\['projects', 'api-keys', '--project-ref', QA_REF, '--reveal', '--output', 'json'\]\)/)
  assert.match(source, /p\.proowner/)
  assert.match(source, /from pg_policies/)
})

test('uncertain identity deletion immediately stops all remaining identity and rate-key cleanup', async () => {
  const cleanup = api('cleanupOwnedQaFixtures')
  const state = { actors: [{ authId: '10000000-0000-4000-8000-000000000002' }, { authId: '10000000-0000-4000-8000-000000000003' }],
    uncertain: [], rateKeys: [`private_mutation:${'a'.repeat(64)}`] }
  const deleted = [], rates = []
  assert.equal(await cleanup(state, { deleteActor: async actor => { deleted.push(actor.authId); throw new Error('unknown delete outcome') },
    deleteRates: async keys => { rates.push(keys) } }), false)
  assert.deepEqual(deleted, [state.actors[1].authId])
  assert.deepEqual(rates, [])
  assert.deepEqual(state.uncertain, ['auth-cleanup'])
})

test('pending real sign-in or registration cannot be overridden by later revocation evidence or cleanup', async () => {
  const quiesce = api('quiesceBeforeQaCleanup'), cleanup = api('cleanupOwnedQaFixtures')
  for (const uncertain of [['auth-signin'], ['registration']]) {
    let deletes = 0
    const state = { actors: [], uncertain, rateKeys: [], app: { stop: async () => {} } }
    assert.equal(await quiesce(state), false)
    assert.equal(await cleanup(state, { deleteActor: async () => { deletes++ }, deleteRates: async () => { deletes++ } }), false)
    assert.equal(deletes, 0)
  }
})

test('Windows CLI launcher uses the proven separated wrapper argv without nested cmd quoting', () => {
  const invocation = api('qaCliInvocation')
  const command = invocation(['db', 'query', '--help'])
  assert.deepEqual(command.args, ['/d', '/c', 'E:\\Proyectos\\GitHub\\Lysto\\scripts\\supabase-lysto.cmd', 'db', 'query', '--help'])
  assert.equal(command.options.windowsHide, true)
  assert.equal(command.options.shell, undefined)
  for (const unsafe of ['bad&command', 'bad|command', 'bad\ncommand', 'bad%value', 'bad"value']) assert.throws(() => invocation([unsafe]))
})

test('preexisting QA rate buckets are pinned unchanged, never treated as owned empty fixture data', () => {
  const guard = api('assertQaBaseline')
  assert.doesNotThrow(() => guard(baseline()))
  for (const count of [0, 411, 413]) assert.throws(() => guard({ ...baseline(), counts: { ...baseline().counts, 'private.rate_limit_buckets': count } }))
  assert.throws(() => guard({ ...baseline(), rateFingerprint: 'c'.repeat(32) }))
  const source = readFileSync(new URL('../../scripts/test-customer-request-http-qa.mjs', import.meta.url), 'utf8')
  assert.match(source, /cli\(\['db', 'query', '--linked', '--project-ref', QA_REF, '--file', file, '--output', 'json'\]\)/)
})

test('SDK user-empty deletion succeeds only with mandatory independent zero-row proof', async () => {
  const verify = api('verifyQaActorDeleted')
  const actor = { authId: '10000000-0000-4000-8000-000000000002' }
  const empty = { users: 0, profiles: 0, customers: 0, sessions: 0 }
  let proofs = 0
  await assert.doesNotReject(verify(actor, { data: { user: {} }, error: null }, async received => { proofs++; assert.equal(received, actor); return empty }))
  assert.equal(proofs, 1)
  await assert.doesNotReject(verify(actor, { data: { user: { id: actor.authId } }, error: null }, async () => empty))
  for (const result of [{ data: { user: {} }, error: { status: 500 } }, { data: { user: {} } },
    { data: { user: { id: '10000000-0000-4000-8000-000000000003' } }, error: null }])
    await assert.rejects(verify(actor, result, async () => { throw new Error('No proof can legitimize an error/foreign response') }))
  for (const key of Object.keys(empty)) await assert.rejects(verify(actor, { data: { user: {} }, error: null }, async () => ({ ...empty, [key]: 1 })))
  await assert.rejects(verify(actor, { data: { user: {} }, error: null }, async () => { throw new Error('Proof unavailable') }))
  assert.equal(actor.authId, '10000000-0000-4000-8000-000000000002')
})

test('post-delete SQL checks only exact known actor identities and performs no deletion', () => {
  const query = api('ownedActorAbsenceSql')
  const actor = { authId: '10000000-0000-4000-8000-000000000002', profileId: '10000000-0000-4000-8000-000000000003',
    customerId: '10000000-0000-4000-8000-000000000004', sessionId: '10000000-0000-4000-8000-000000000005' }
  const sql = query(actor)
  for (const id of Object.values(actor)) assert.ok(sql.includes(id))
  for (const table of ['auth.users', 'public.profiles', 'public.customer_profiles', 'auth.sessions']) assert.ok(sql.includes(table))
  assert.doesNotMatch(sql, /\b(?:delete|update|insert|truncate|alter|grant|revoke)\b/i)
  assert.throws(() => query({ ...actor, authId: "invalid';delete--" }))
})

test('HTTP failure evidence contains only safe enums, status and cache flag, never response bodies or credentials', () => {
  const sanitize = api('safeQaHttpFailure')
  const failure = sanitize({ check: 'stale-home-version-rejected', kind: 'status', status: 503, cacheProtected: true,
    body: 'private-provider-body', password: 'private-password', cookie: 'private-cookie', error: 'private-error' })
  assert.deepEqual(failure, { check: 'stale-home-version-rejected', kind: 'status', status: 503, cacheProtected: true })
  const recorded = api('publicManifest')({ runId: '10000000-0000-4000-8000-000000000001', projectRef: ref, phase: 'http-checks',
    actors: [], uncertain: ['app-mutation'], failure })
  assert.deepEqual(recorded.failure, failure)
  for (const bad of [{ ...failure, kind: 'private-error-body' }, { ...failure, status: 'secret' }, { ...failure, check: token('authenticated') }]) assert.throws(() => sanitize(bad))
  assert.deepEqual(sanitize({ check: 'home-created', kind: 'transport' }), { check: 'home-created', kind: 'transport' })
})

test('HTTP diagnostics retain only approved API error codes and numeric login age, never arbitrary response text', () => {
  const sanitize = api('safeQaHttpFailure')
  const base = { check: 'empty-owned-homes', kind: 'status', status: 503, cacheProtected: true }
  assert.deepEqual(sanitize({ ...base, apiErrorCode: 'session_unavailable', loginToRequestDurationMs: 1400, jwtRemainingSeconds: 3500,
    body: 'secret-body', error: 'secret-error' }), { ...base, apiErrorCode: 'session_unavailable', loginToRequestDurationMs: 1400, jwtRemainingSeconds: 3500 })
  assert.deepEqual(sanitize({ ...base, apiErrorCode: 'service_unavailable' }), { ...base, apiErrorCode: 'service_unavailable' })
  assert.deepEqual(sanitize({ ...base, apiErrorCode: 'private-token-as-code' }), base)
  assert.throws(() => sanitize({ ...base, loginToRequestDurationMs: 'secret' }))
  assert.throws(() => sanitize({ ...base, jwtRemainingSeconds: NaN }))
})

test('JWT timing diagnostics expose only numeric iat/exp/TTL and reject malformed or reversed timestamps', () => {
  const timing = api('safeQaJwtTiming')
  assert.deepEqual(timing({ iat: 1000, exp: 4600, access_token: 'private-token', app_metadata: { private: 'secret' } }), { iat: 1000, exp: 4600, ttlSeconds: 3600 })
  for (const malformed of [{ iat: 'private-token', exp: 4600 }, { iat: 1000, exp: NaN }, { iat: 1000, exp: 1000 }, { iat: -1, exp: 1000 }])
    assert.throws(() => timing(malformed))
})

test('logout keeps the verified login token in RAM independently of response-mutated SSR cookies', async () => {
  const retain = api('retainVerifiedQaLogin'), revoke = api('verifyQaSessionRevocation')
  const runId = '10000000-0000-4000-8000-000000000001', authId = '10000000-0000-4000-8000-000000000002', sessionId = '10000000-0000-4000-8000-000000000003'
  const actor = { runId, authId, email: `pedir-http-${runId}-0@lysto.invalid`, jar: new Map([['cookie', 'private-cookie']]),
    client: { auth: { signOut: async () => { throw new Error('Do not use the mutable SSR jar for teardown') } } } }
  const issued = [Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'),
    Buffer.from(JSON.stringify({ iss: `https://${ref}.supabase.co/auth/v1`, sub: authId, role: 'authenticated', session_id: sessionId,
      app_metadata: { app_role: 'customer' }, iat: 1000, exp: 4600 })).toString('base64url'), 'unit-only-not-authenticated'].join('.')
  const identity = { user: { id: authId, email: actor.email, app_metadata: { app_role: 'customer', signup_source: 'qa_pedir_http', qa_pedir_http_run: runId } } }
  retain(actor, { access_token: issued }, identity, 1000000)
  actor.jar.clear()
  let actualToken
  await revoke([actor], async () => 0, async owned => { actualToken = owned.logoutAccessToken; return { data: null, error: null } })
  assert.equal(actualToken, issued); assert.equal(actor.sessionId, sessionId)
  const output = JSON.stringify(api('publicManifest')({ projectRef: ref, runId, phase: 'cleanup', actors: [actor], uncertain: [], rateKeys: [], nextReadyDurationMs: 1200 }))
  assert.equal(output.includes(issued), false); assert.equal(output.includes('private-cookie'), false)
  assert.deepEqual(JSON.parse(output).actors[0].jwtTiming, { iat: 1000, exp: 4600, ttlSeconds: 3600 })
  assert.equal(JSON.parse(output).nextReadyDurationMs, 1200)
  assert.throws(() => retain({ ...actor }, { access_token: issued }, { user: { ...identity.user, id: sessionId } }, 1000000))
})

test('session proof diagnostics distinguish remaining sessions, invalid count and unavailable evidence without raw errors', async () => {
  const revoke = api('verifyQaSessionRevocation'), sanitize = api('safeQaSessionRevocation')
  const actor = { logoutAccessToken: 'unit-only-not-authenticated' }, reports = []
  const signOut = async () => ({ data: null, error: null })
  await assert.rejects(revoke([actor], async () => 2, signOut, report => reports.push(report)), /session_proof_remaining/)
  await assert.rejects(revoke([actor], async () => 'secret-count', signOut, report => reports.push(report)), /session_proof_invalid/)
  await assert.rejects(revoke([actor], async () => { throw new Error('CLI stdout could contain private information') }, signOut, report => reports.push(report)), /session_proof_unavailable/)
  assert.deepEqual(reports, [{ logout: ['success'], proof: 'remaining', remainingSessions: 2 }, { logout: ['success'], proof: 'invalid' }, { logout: ['success'], proof: 'unavailable' }])
  assert.deepEqual(sanitize({ logout: ['error'], proof: 'zero', remainingSessions: 0, error: 'private-server-body' }), { logout: ['error'], proof: 'zero', remainingSessions: 0 })
  assert.throws(() => sanitize({ logout: ['private-error-body'], proof: 'zero' }))
  assert.throws(() => sanitize({ logout: ['success'], proof: 'private-error-body' }))
})
