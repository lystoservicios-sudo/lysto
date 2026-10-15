import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const helper = await import('../../scripts/recover-customer-request-http-qa.mjs').catch(() => ({}))
const ref = 'obksyzasmfwcbbksesqt', run = '0f3d5c73-1789-40e2-a240-f45251449195'
const actors = [
  { email: `pedir-http-${run}-0@lysto.invalid`, authId: '349189d5-62c3-4787-90fb-127bc484b61a', profileId: '0227349b-882f-412e-8269-76fdfd9e234d', customerId: '79898b8e-0bf2-40bd-a5ce-3bf709fa4422', sessionId: '656034ff-b121-47bc-9eb9-ef222b67963a' },
  { email: `pedir-http-${run}-1@lysto.invalid`, authId: '748c4256-3097-4b75-aae2-2c17b6105ed2', profileId: 'ed366c73-cd98-410f-94af-e1b5f91069a7', customerId: '5d578867-5369-4c88-888d-d76e2940efd0', sessionId: '76dd2287-e061-4d04-a75d-e5a61fac2088' }
]
const rates = ['private_mutation:526b5fcb1e382dce82423362c9187d43995d79afe7da3e160c9f8a75ce2c3c93', 'private_mutation:903cf10cadb8dbce9e520ce2858ad8f24aa8b76346a7ca9a84cfec3687da1d1a']
const baseline = () => ({ migrationCount: 78, lastMigration: '20261014213321', versions: Array.from({ length: 78 }, (_, i) => `fixture-${i}`), writerRoleExists: false,
  quotePolicyId: null, requestPolicyEnabled: false, counts: { 'auth.users': 0, 'auth.sessions': 0, 'auth.identities': 0, 'auth.refresh_tokens': 0, 'public.profiles': 0,
    'public.customer_profiles': 0, 'public.jobs': 0, 'private.customer_request_previews': 0, 'private.customer_request_contracts': 0, 'private.rate_limit_buckets': 412 },
  permissionsFingerprint: '0dba5bf87d8da974cfdc2711d7486ab9', policyFingerprint: '3ee440e82d6f796d9c805576f1d130b1', rateFingerprint: '72f3c806dda6d3dda0a139eb5cc2458b' })
const manifest = () => ({ projectRef: ref, runId: run, phase: 'cleanup-required', uncertain: ['app-mutation'], actors: structuredClone(actors), rateKeys: [...rates], baseline: baseline() })
const identity = actor => ({ id: actor.authId, email: actor.email, app_metadata: { app_role: 'customer', signup_source: 'qa_pedir_http', qa_pedir_http_run: run } })
const proof = (m, remaining = actors) => ({ normalized: structuredClone(m.baseline), ownedSessions: 0, inflightHomeRpc: 0, ownedRows: remaining.length * 3,
  actors: actors.map(actor => remaining.some(value => value.authId === actor.authId)
    ? { authId: actor.authId, exists: true, email: actor.email, appRole: 'customer', source: 'qa_pedir_http', runId: run, profileId: actor.profileId, customerId: actor.customerId, relationsMatch: true }
    : { authId: actor.authId, exists: false, email: null, appRole: null, source: null, runId: null, profileId: null, customerId: null, relationsMatch: true }) })
const key = (projectRef = ref, role = 'service_role', exp = Math.floor(Date.now() / 1000) + 3600) => [
  Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'), Buffer.from(JSON.stringify({ ref: projectRef, role, exp })).toString('base64url'), 'local-test-not-a-real-signature'
].join('.')
const api = name => { assert.equal(typeof helper[name], 'function', `Recovery helper must implement ${name}`); return helper[name] }

test('import and default invocation are inert: no credential, network, fixture, or process operation', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('network forbidden') }
  try { const result = await api('main')([]); assert.equal(result.mode, 'dry-run'); assert.equal(result.runId, run); assert.equal(calls, 0) }
  finally { globalThis.fetch = original }
})

test('one-run execution needs exact QA, exact manifest path and explicit reconciliation; no overrides', () => {
  const parse = api('parseRecoveryArguments'), path = helper.RECOVERY_MANIFEST_PATH
  assert.equal(parse(['--execute', '--qa-ref', ref, '--manifest', path, '--reconciled-run', run]).mode, 'execute')
  for (const args of [['--execute'], ['--execute', '--qa-ref', 'dqonlqcurvjnjgsczevu', '--manifest', path, '--reconciled-run', run],
    ['--execute', '--qa-ref', ref, '--manifest', 'other.json', '--reconciled-run', run],
    ['--execute', '--qa-ref', ref, '--manifest', path, '--reconciled-run', '10000000-0000-4000-8000-000000000001'], ['--db-url', 'postgres://test']]) assert.throws(() => parse(args))
})

test('scope binds the original pending run, both identities, HMACs and old baseline; rejects another run and history', () => {
  const guard = api('assertRecoveryManifest'), m = manifest()
  assert.doesNotThrow(() => guard(m))
  for (const altered of [{ ...m, projectRef: 'dqonlqcurvjnjgsczevu' }, { ...m, phase: 'cleaned' }, { ...m, uncertain: [] },
    { ...m, uncertain: ['auth-signin'] }, { ...m, actors: [{ ...actors[0], authId: actors[1].authId }, actors[1]] },
    { ...m, rateKeys: [`private_mutation:${'a'.repeat(64)}`] }, { ...m, baseline: { ...m.baseline, migrationCount: 79 } }]) assert.throws(() => guard(altered))
  assert.throws(() => api('assertPinnedManifestBytes')(Buffer.from(JSON.stringify(m))))
})

test('fresh owner proof requires zero sessions, no pending RPC, exact identities and unchanged normalized snapshot', () => {
  const guard = api('assertRecoveryProof'), m = manifest(), safe = proof(m)
  assert.doesNotThrow(() => guard(m, safe))
  for (const altered of [{ ...safe, ownedSessions: 1 }, { ...safe, inflightHomeRpc: 1 },
    { ...safe, actors: [{ ...safe.actors[0], email: 'real@other.example' }, safe.actors[1]] },
    { ...safe, normalized: { ...m.baseline, permissionsFingerprint: 'other' } },
    { ...safe, normalized: { ...m.baseline, counts: { ...m.baseline.counts, 'public.jobs': 1 } } },
    { ...safe, normalized: { ...m.baseline, rateFingerprint: 'c'.repeat(32) } }]) assert.throws(() => guard(m, altered))
  const absent = proof(m, [])
  assert.doesNotThrow(() => guard(m, absent))
  assert.throws(() => guard(m, { ...absent, actors: [{ ...absent.actors[0], profileId: actors[0].profileId }, absent.actors[1]] }))
})

test('proof SQL excludes only fixture owners and exact rate keys, never jobs or commercial artifacts', () => {
  const sql = api('recoveryProofSql')(manifest())
  for (const actor of actors) for (const field of ['authId', 'profileId', 'customerId']) assert.ok(sql.includes(actor[field]))
  for (const value of rates) assert.ok(sql.includes(value))
  assert.match(sql, /pg_stat_activity/); assert.match(sql, /auth\.sessions/); assert.match(sql, /raw_app_meta_data/)
  assert.doesNotMatch(sql, /delete|pg_terminate_backend|truncate|insert into|update auth/i)
  assert.doesNotMatch(sql, /when 'public\.jobs'|when 'private\.customer_request_(previews|contracts)'/i)
})

test('normalization keeps NULL ownership rows visible, excluding only a proven TRUE fixture-owner predicate', () => {
  const sql = api('recoveryProofSql')(manifest())
  assert.match(sql, /select count\(\*\) as count from %I\.%I where \(%s\) is not true/i)
  assert.doesNotMatch(sql, /where not \(%s\)/i)
})

test('service key validation rejects production, public, expired and malformed keys without revealing them', () => {
  const validate = api('assertRecoveryServiceKey')
  const valid = key()
  assert.equal(validate(valid), valid)
  for (const secret of [key('dqonlqcurvjnjgsczevu'), key(ref, 'anon'), key(ref, 'service_role', 1), 'sb_secret_rejected_do_not_echo']) {
    assert.throws(() => validate(secret), error => error.message === 'qa_recovery_guard_failed' && !error.message.includes(secret))
  }
})

test('Auth transport admits only GET/DELETE exact known users; disallows create/login/providers and leaks', async () => {
  let calls = 0, options
  const fetcher = async (_url, init) => { calls++; options = init; return new Response('{}', { status: 200 }) }
  const http = api('boundedRecoveryFetch')(fetcher)
  const url = `https://${ref}.supabase.co/auth/v1/admin/users/${actors[0].authId}`
  await http(url, { method: 'GET' }); await http(url, { method: 'DELETE' })
  assert.equal(options.redirect, 'error'); assert.ok(options.signal)
  for (const [target, method] of [[url, 'POST'], [`https://${ref}.supabase.co/auth/v1/admin/users`, 'POST'],
    [`https://${ref}.supabase.co/auth/v1/token`, 'POST'], [url.replace(ref, 'dqonlqcurvjnjgsczevu'), 'DELETE'],
    [url.replace(actors[0].authId, '10000000-0000-4000-8000-000000000001'), 'DELETE'], [`${url}?unexpected=true`, 'DELETE']]) await assert.rejects(http(target, { method }))
  assert.equal(calls, 2)
  const uncertain = api('boundedRecoveryFetch')(async () => { throw new Error('secret API token must never appear') })
  await assert.rejects(uncertain(url, { method: 'DELETE' }), error => error.message === 'qa_recovery_transport_failed')
})

function harness(m, alterations = {}) {
  const remaining = [...actors], events = [], receipts = []
  const deps = {
    assertPortClosed: async () => { events.push('port') },
    query: async sql => { events.push(sql.includes('delete from private.rate_limit_buckets') ? 'rates' : 'proof'); return sql.includes('delete from private.rate_limit_buckets') ? { cleaned: 1 } : { proof: proof(m, remaining) } },
    readServiceKey: async () => { events.push('key'); return key() },
    clientFactory: () => ({ auth: { admin: {
      getUserById: async id => { events.push(`get:${id}`); return { data: { user: identity(actors.find(a => a.authId === id)) }, error: null } },
      deleteUser: async id => { events.push(`delete:${id}`); remaining.splice(remaining.findIndex(a => a.authId === id), 1); return { data: { user: identity(actors.find(a => a.authId === id)) }, error: null } }
    } } }),
    snapshot: async () => { events.push('snapshot'); return structuredClone(m.baseline) },
    record: receipt => receipts.push(structuredClone(receipt)), ...alterations
  }
  return { deps, remaining, events, receipts }
}

test('real orchestration checks quiescence before keys and each identity, records pending before mutation and verifies final baseline', async () => {
  const m = manifest(), h = harness(m)
  const result = await api('recoverOwnedQaRun')(m, h.deps)
  assert.equal(result.phase, 'restored')
  assert.deepEqual(h.events.slice(0, 3), ['port', 'proof', 'key'])
  assert.equal(h.events.filter(event => event === 'port').length, 6)
  assert.deepEqual(h.events.filter(event => event.startsWith('delete:')), actors.map(actor => `delete:${actor.authId}`))
  assert.ok(h.events.indexOf('rates') > h.events.lastIndexOf(`delete:${actors[1].authId}`))
  assert.ok(h.receipts.some(receipt => receipt.pending === actors[0].authId))
  assert.deepEqual(m.uncertain, ['app-mutation'])
  assert.equal(JSON.stringify(h.receipts).includes('local-test-not-a-real-signature'), false)
})

test('fresh session or pending RPC blocks credentials and all mutations', async () => {
  const m = manifest()
  for (const property of ['ownedSessions', 'inflightHomeRpc']) {
    const h = harness(m, { query: async () => ({ proof: { ...proof(m), [property]: 1 } }) })
    await assert.rejects(api('recoverOwnedQaRun')(m, h.deps))
    assert.equal(h.events.includes('key'), false); assert.equal(h.events.some(event => event.startsWith('delete:')), false)
  }
})

test('unknown first Auth deletion stops next identity and all rate cleanup, recording only generic pending marker', async () => {
  const m = manifest(), h = harness(m)
  h.deps.clientFactory = () => ({ auth: { admin: { getUserById: async id => ({ data: { user: identity(actors.find(a => a.authId === id)) }, error: null }),
    deleteUser: async id => { h.events.push(`delete:${id}`); throw new Error('private-provider-body') } } } })
  await assert.rejects(api('recoverOwnedQaRun')(m, h.deps), /qa_recovery_failed/)
  assert.deepEqual(h.events.filter(event => event.startsWith('delete:')), [`delete:${actors[0].authId}`])
  assert.equal(h.events.includes('rates'), false)
  assert.equal(h.receipts.at(-1).phase, 'recovery-required'); assert.equal(h.receipts.at(-1).pending, actors[0].authId)
  assert.equal(JSON.stringify(h.receipts).includes('private-provider-body'), false)
})

test('Auth API mismatch and false absence never authorize deletion despite SQL owner proof', async () => {
  const m = manifest()
  for (const lookup of [{ data: { user: { ...identity(actors[0]), email: 'other@invalid.example' } }, error: null },
    { data: { user: null }, error: { status: 404 } }]) {
    const h = harness(m); let deletes = 0
    h.deps.clientFactory = () => ({ auth: { admin: { getUserById: async () => lookup, deleteUser: async () => { deletes++; return { error: null } } } } })
    await assert.rejects(api('recoverOwnedQaRun')(m, h.deps)); assert.equal(deletes, 0); assert.equal(h.events.includes('rates'), false)
  }
})

test('idempotent recovery skips genuinely absent Auth identities only with fresh cascades-absent proof', async () => {
  const m = manifest(), h = harness(m)
  h.remaining.splice(0)
  h.deps.clientFactory = () => ({ auth: { admin: { getUserById: async () => ({ data: { user: null }, error: { status: 404 } }),
    deleteUser: async () => { throw new Error('absent must not delete') } } } })
  assert.equal((await api('recoverOwnedQaRun')(m, h.deps)).phase, 'restored')
  assert.equal(h.events.some(event => event.startsWith('delete:')), false)
})

test('rate cleanup locks then rechecks owner absence and normalized baseline in transaction; only exact keys targeted', () => {
  const sql = api('recoveryRateCleanupSql')(manifest())
  assert.match(sql, /begin;/i); assert.match(sql, /lock table private\.rate_limit_buckets in share row exclusive mode/i)
  assert.ok(sql.indexOf('qa_recovery_before') < sql.indexOf('delete from private.rate_limit_buckets'))
  assert.match(sql, /delete from private\.rate_limit_buckets where key = any/i)
  assert.match(sql, /qa_recovery_owned_actor_present/); assert.match(sql, /qa_recovery_baseline_changed/)
  for (const rate of rates) assert.ok(sql.includes(rate))
  assert.doesNotMatch(sql, /delete from auth|delete from public|truncate|prune|pg_terminate_backend/i)
})

test('new receipt allows only bounded safe phases/UUIDs and does not reinterpret original uncertain HTTP result', () => {
  const receipt = api('publicRecoveryReceipt')({ phase: 'auth-delete-pending', pending: actors[0].authId, deleted: [actors[1].authId],
    secret: 'do-not-persist', serviceKey: key(), rawError: 'private-body', baseline: baseline() })
  assert.equal(receipt.runId, run); assert.deepEqual(receipt.originalUncertain, ['app-mutation'])
  for (const text of ['do-not-persist', 'serviceKey', 'private-body', 'local-test-not-a-real-signature']) assert.equal(JSON.stringify(receipt).includes(text), false)
  assert.throws(() => api('publicRecoveryReceipt')({ phase: 'private-provider-body', pending: null, deleted: [] }))
})

test('main fixed transports use original Owner wrapper, explicit QA, RAM keys and no browser/Next or session deletion', () => {
  const source = readFileSync(new URL('../../scripts/recover-customer-request-http-qa.mjs', import.meta.url), 'utf8')
  assert.match(source, /qaCliInvocation/)
  assert.match(source, /\['projects', 'api-keys', '--project-ref', QA_REF, '--reveal', '--output', 'json'\]/)
  assert.match(source, /\['db', 'query', '--linked', '--project-ref', QA_REF, '--file', file, '--output', 'json'\]/)
  assert.doesNotMatch(source, /delete from auth\.sessions|spawn\(|startOwnedQaApp|readFile.*\.env|dotenv|\b(?:chrome|opera|edge|docker)\b/i)
  assert.match(source, /assertPinnedManifestBytes/)
})

test('documented Auth DELETE user:{} succeeds only after a fresh independent actor-absence proof', async () => {
  const m = manifest(), h = harness(m)
  const client = h.deps.clientFactory()
  client.auth.admin.deleteUser = async id => {
    h.events.push(`delete:${id}`)
    h.remaining.splice(h.remaining.findIndex(actor => actor.authId === id), 1)
    return { data: { user: {} }, error: null }
  }
  h.deps.clientFactory = () => client
  assert.equal((await api('recoverOwnedQaRun')(m, h.deps)).phase, 'restored')
  for (const actor of actors) {
    const at = h.events.indexOf(`delete:${actor.authId}`)
    assert.deepEqual(h.events.slice(at + 1, at + 3), ['port', 'proof'])
  }
  assert.deepEqual(h.receipts.filter(receipt => receipt.phase === 'auth-deleted').map(receipt => receipt.deleted.at(-1)), actors.map(actor => actor.authId))
})

test('DELETE success-shaped response cannot clear pending when the actual actor still exists', async () => {
  const m = manifest(), h = harness(m), client = h.deps.clientFactory()
  client.auth.admin.deleteUser = async id => { h.events.push(`delete:${id}`); return { data: { user: { id } }, error: null } }
  h.deps.clientFactory = () => client
  await assert.rejects(api('recoverOwnedQaRun')(m, h.deps))
  assert.deepEqual(h.events.filter(event => event.startsWith('delete:')), [`delete:${actors[0].authId}`])
  assert.equal(h.events.includes('rates'), false)
  assert.equal(h.receipts.at(-1).pending, actors[0].authId)
  assert.deepEqual(h.receipts.at(-1).deleted, [])
})

test('a failed fresh proof after DELETE user:{} preserves pending and stops all further mutations', async () => {
  const m = manifest(), h = harness(m), client = h.deps.clientFactory()
  let attempted = false, postDeleteReads = 0
  const query = h.deps.query
  h.deps.query = async sql => { if (attempted) { postDeleteReads++; throw new Error('private-query-detail') }; return query(sql) }
  client.auth.admin.deleteUser = async id => {
    h.events.push(`delete:${id}`); attempted = true
    h.remaining.splice(h.remaining.findIndex(actor => actor.authId === id), 1)
    return { data: { user: {} }, error: null }
  }
  h.deps.clientFactory = () => client
  await assert.rejects(api('recoverOwnedQaRun')(m, h.deps))
  assert.equal(postDeleteReads, 1)
  assert.equal(h.receipts.at(-1).pending, actors[0].authId)
  assert.deepEqual(h.receipts.at(-1).deleted, [])
  assert.equal(h.events.includes('rates'), false)
  assert.equal(JSON.stringify(h.receipts).includes('private-query-detail'), false)
})

test('DELETE returned wrong UUID or non-null/non-explicit error never authorizes absence checks or next cleanup', async () => {
  const m = manifest()
  for (const response of [{ data: { user: { id: actors[1].authId } }, error: null },
    { data: { user: { id: actors[0].authId } }, error: { status: 500 } },
    { data: { user: { id: actors[0].authId } } }]) {
    const h = harness(m), client = h.deps.clientFactory()
    client.auth.admin.deleteUser = async id => { h.events.push(`delete:${id}`); h.remaining.shift(); return response }
    h.deps.clientFactory = () => client
    await assert.rejects(api('recoverOwnedQaRun')(m, h.deps))
    assert.deepEqual(h.events.filter(event => event.startsWith('delete:')), [`delete:${actors[0].authId}`])
    assert.equal(h.events.filter(event => event === 'proof').length, 2)
    assert.equal(h.receipts.at(-1).pending, actors[0].authId)
    assert.deepEqual(h.receipts.at(-1).deleted, [])
    assert.equal(h.events.includes('rates'), false)
  }
})
