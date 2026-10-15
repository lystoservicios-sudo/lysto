import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const runner = await import('../../scripts/test-customer-request-staging.mjs').catch(() => ({}))
const qa = 'obksyzasmfwcbbksesqt'
const production = 'dqonlqcurvjnjgsczevu'

test('staging runner exists without performing any imported side effect', () => {
  assert.equal(typeof runner.assertStagingTarget, 'function')
  assert.equal(typeof runner.main, 'function')
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./scripts/test-customer-request-staging.mjs'); console.log('inert import');"], { encoding: 'utf8' })
  assert.equal(result.status, 0)
  assert.equal(result.stdout.trim(), 'inert import')
  assert.equal(result.stderr, '')
})
test('staging target guard rejects production, missing and unapproved targets', () => {
  assert.equal(typeof runner.assertStagingTarget, 'function')
  for (const ref of [production, undefined, '', 'otherprojectref']) assert.throws(() => runner.assertStagingTarget(ref))
  assert.equal(runner.assertStagingTarget(qa), qa)
})
test('manifest owns unique exact UUIDs, no provider credentials and fixed staging identity', () => {
  assert.equal(typeof runner.createManifest, 'function')
  const m = runner.createManifest(qa)
  assert.equal(m.projectRef, qa)
  const ids = Object.values(m.ids)
  assert.equal(ids.length, new Set(ids).size)
  assert.ok(ids.length > 25)
  assert.ok(ids.every(id => /^[0-9a-f-]{36}$/.test(id)))
  assert.doesNotMatch(JSON.stringify(m), /APP_USR|TEST-|password|access_token/i)
})
test('manifest validation rejects malformed, duplicate, foreign or incomplete identities before remote work', () => {
  assert.equal(typeof runner.assertManifest, 'function')
  const m = runner.createManifest(qa)
  assert.doesNotThrow(() => runner.assertManifest(m))
  for (const broken of [
    { ...m, runId: 'x' }, { ...m, projectRef: production }, { ...m, ids: {} },
    { ...m, ids: { ...m.ids, a_user: m.ids.pro_user } },
    { ...m, ids: { ...m.ids, unexpected: randomUUID() } },
    { ...m, sourceHashes: { ...m.sourceHashes, '20261013141601_customer_hogar.sql': 'wrong' } }
  ]) assert.throws(() => runner.assertManifest(broken))
})
test('preflight SQL is read-only and works before missing Hogar/Pedir tables exist', () => {
  assert.equal(typeof runner.buildPreflightSql, 'function')
  const sql = runner.buildPreflightSql()
  assert.match(sql, /to_regclass\('private.customer_request_previews'\)/)
  assert.match(sql, /quotePolicyCount/)
  assert.match(sql, /service_categories/)
  assert.doesNotMatch(sql, /\b(?:insert|update|delete|truncate|alter|create|grant|revoke)\b/i)
})
test('prerequisites are an exact five-source atomic staging transaction, not db push', () => {
  assert.equal(typeof runner.buildPrerequisiteSql, 'function')
  const sql = runner.buildPrerequisiteSql(runner.createManifest(qa))
  for (const version of ['20261004011254', '20261013141601', '20261014023946', '20261014213321', '20261014235503']) assert.match(sql, new RegExp(version))
  assert.match(sql, /count\(\*\).*supabase_migrations\.schema_migrations/s)
  assert.match(sql, /74/)
  assert.match(sql, /20260923154658/)
  assert.match(sql, /auth\.users/)
  assert.match(sql, /^-- STAGING ONLY[\s\S]+begin;[\s\S]+commit;\s*$/i)
  assert.doesNotMatch(sql, /db push|create role|alter role|grant lysto_marketplace to/i)
})

test('new concurrency execution requires the exact reviewed 79-migration baseline before fixture API writes', () => {
  assert.equal(typeof runner.assertReadyStagingMigrations, 'function')
  assert.doesNotThrow(() => runner.assertReadyStagingMigrations({ migrationCount: 79, migrationLatest: '20261014235503' }))
  for (const preflight of [{ migrationCount: 78, migrationLatest: '20261014213321' }, { migrationCount: 80, migrationLatest: '20261014235503' },
    { migrationCount: 79, migrationLatest: 'unexpected' }]) assert.throws(() => runner.assertReadyStagingMigrations(preflight))
  const source = readFileSync('scripts/test-customer-request-staging.mjs', 'utf8')
  const main = source.slice(source.indexOf('export async function main('))
  assert.ok(main.indexOf("'migration-preflight'") < main.indexOf("mutateSyntheticAvatar(m,directory,'upload')"))
})
test('fixture setup enforces empty target, synthetic identity and approved 18/82 gross split', () => {
  assert.equal(typeof runner.buildFixtureSetupSql, 'function')
  const sql = runner.buildFixtureSetupSql(runner.createManifest(qa))
  assert.match(sql, /Auth or application data appeared/)
  assert.match(sql, /@pedir-concurrency\.invalid/)
  assert.match(sql, /platformFeeRate',\.18/)
  assert.match(sql, /platformFee',23400,'professionalAmount',106600/)
  assert.match(sql, /paymentCostRate',0/)
  assert.match(sql, /paymentCostBudget',0/)
  assert.doesNotMatch(sql, /configure_customer_request_contract|paymentCostRate',\.06|https:\/\/api\.mercadopago/)
})
test('workers commit real shared fixtures and include independent backend identity', () => {
  assert.equal(typeof runner.buildWorkerSql, 'function')
  const m = runner.createManifest(qa)
  const sql = runner.buildWorkerSql(m, { actor: 'a', previewId: randomUUID(), commandId: randomUUID(), marker: 'case-a', holdSeconds: 12 })
  assert.match(sql, /set local role service_role/)
  assert.match(sql, /public\.prepare_customer_request/)
  assert.match(sql, /pg_backend_pid\(\)/)
  assert.match(sql, /pg_sleep\(12\)/)
  assert.match(sql, /commit;/)
  assert.doesNotMatch(sql, /rollback;/)
})
test('cleanup is exact-owner scoped, transactional, restores pointers and does not disable triggers', () => {
  assert.equal(typeof runner.buildCleanupSql, 'function')
  const m = runner.createManifest(qa)
  m.baseline = { quoteCurrent: { singleton: true, policy_id: null }, requestCurrent: { singleton: true, enabled: false, policy_id: null, version: 0 } }
  const sql = runner.buildCleanupSql(m)
  assert.match(sql, /fixture identity mismatch/)
  assert.match(sql, /profile identity mismatch/)
  assert.match(sql, /professional identity mismatch/)
  assert.match(sql, /delete from auth\.users where id in \(/)
  assert.match(sql, /delete from private\.customer_request_policy_versions where id=/)
  assert.match(sql, /set policy_id=null/)
  assert.match(sql, /commit;/)
  assert.doesNotMatch(sql, /truncate|disable trigger|delete from [^;]+;\s*$/i)
  for (const line of sql.split('\n').filter(line => /^delete from /i.test(line))) assert.match(line, / where /i)
})
test('canonical results require distinct actual SQL backends and equal idempotent result', () => {
  assert.equal(typeof runner.assertPairResults, 'function')
  const result = { status: 'ready', jobId: randomUUID() }
  assert.throws(() => runner.assertPairResults('same-command', { pid: 1, result }, { pid: 1, result }))
  assert.throws(() => runner.assertPairResults('same-command', { pid: 1, result }, { pid: 2, result: { status: 'unavailable' } }))
  assert.doesNotThrow(() => runner.assertPairResults('same-command', { pid: 1, result }, { pid: 2, result }))
})
test('financial concurrency operates on exact synthetic checkout and never calls a provider', () => {
  assert.equal(typeof runner.buildFinancialWorkerSql, 'function')
  const sql = runner.buildFinancialWorkerSql(runner.createManifest(qa), { operation: 'approve', jobId: randomUUID(), checkoutId: randomUUID(), marker: 'financial-a', holdSeconds: 12 })
  assert.match(sql, /update public\.marketplace_checkouts set status='approved' where id=/)
  assert.match(sql, /customer_id=/)
  assert.match(sql, /professional_id=/)
  assert.match(sql, /live_mode=false/)
  assert.match(sql, /pg_backend_pid\(\)/)
  assert.match(sql, /commit;/)
  assert.doesNotMatch(sql, /https:\/\/|insert into public\.payments|marketplace_payment_observations/)
})
test('late database approval after released capacity becomes review rather than a false booking', () => {
  assert.equal(typeof runner.assertPairResults, 'function')
  const a = { pid: 1, result: { reservation: 'expired', contract: 'expired', status: 'cancelled' } }
  const b = { pid: 2, result: { reservation: 'expired', contract: 'payment_review', status: 'review' } }
  assert.doesNotThrow(() => runner.assertPairResults('expiry-approval', a, b))
  assert.throws(() => runner.assertPairResults('expiry-approval', a, { ...b, result: { reservation: 'confirmed', contract: 'paid', status: 'approved' } }))
})
test('approval before expiry preserves a paid confirmed reservation in both connections', () => {
  const result = { reservation: 'confirmed', contract: 'paid', status: 'approved' }
  assert.doesNotThrow(() => runner.assertPairResults('approval-expiry', { pid: 1, result }, { pid: 2, result }))
  assert.throws(() => runner.assertPairResults('approval-expiry', { pid: 1, result }, { pid: 2, result: { ...result, reservation: 'expired' } }))
})
test('uncertain remote mutations prohibit automatic destructive cleanup', () => {
  assert.equal(typeof runner.shouldCleanAutomatically, 'function')
  assert.equal(runner.shouldCleanAutomatically({ remoteUncertain: true }), false)
  assert.equal(runner.shouldCleanAutomatically({ remoteUncertain: false }), true)
})
test('cleanup rejects null-email actors and any foreign complete commercial pointer tuple under locks', () => {
  const m = runner.createManifest(qa)
  m.baseline = { quoteCurrent: { singleton: true, policy_id: null }, requestCurrent: { singleton: true, enabled: false, policy_id: null, version: 0 } }
  const sql = runner.buildCleanupSql(m)
  assert.match(sql, /email is distinct from \(id::text\|\|'@pedir-concurrency\.invalid'\)/)
  assert.match(sql, /into v_request from private\.customer_request_policy_current where singleton for update/)
  assert.match(sql, /row\(v_request\.enabled,v_request\.policy_id,v_request\.version\) is distinct from row\(false,null::uuid,0\)/)
  assert.match(sql, new RegExp(`row\\(v_request\\.enabled,v_request\\.policy_id,v_request\\.version\\) is distinct from row\\(true,'${m.ids.request_policy}'::uuid,1\\)`))
  assert.match(sql, /into v_quote from private\.quote_policy_current where singleton for update/)
  assert.match(sql, /row\(v_quote\.singleton,v_quote\.policy_id\) is distinct from row\(true,null::uuid\)/)
  assert.match(sql, /Foreign request policy tuple: refusing cleanup/)
  assert.ok(sql.indexOf('for update') < sql.indexOf('update private.quote_policy_current set'))
})
test('all fixture Storage mutations use its API; SQL only checks exact object absence', () => {
  const m = runner.createManifest(qa)
  m.baseline = { quoteCurrent: { singleton: true, policy_id: null }, requestCurrent: { singleton: true, enabled: false, policy_id: null, version: 0 } }
  const sql = runner.buildCleanupSql(m)
  const setup = runner.buildFixtureSetupSql(m)
  assert.doesNotMatch(sql + setup, /(?:insert into|delete from|update) storage\.|storage\.allow_delete_query|disable trigger/i)
  assert.match(sql, /Synthetic avatar remains: use the scoped Storage API cleanup first/)
  assert.match(sql, new RegExp(m.ids.pro_user))
  assert.match(sql, new RegExp(m.ids.avatar))
})
test('Storage cleanup authority checks the exact synthetic user, profile, professional and avatar path before API writes', () => {
  assert.equal(typeof runner.buildStorageOwnershipSql, 'function')
  const sql = runner.buildStorageOwnershipSql(runner.createManifest(qa))
  assert.match(sql, /auth\.users/)
  assert.match(sql, /@pedir-concurrency\.invalid/)
  assert.match(sql, /p\.auth_user_id/)
  assert.match(sql, /pro\.profile_id/)
  assert.match(sql, /a\.object_path/)
  assert.doesNotMatch(sql, /\b(?:insert|delete|update|alter|grant|revoke)\b/i)
})
test('QA credential validation accepts only a service-role JWT bound to the explicit QA project without echoing secrets', () => {
  assert.equal(typeof runner.assertQaServiceKey, 'function')
  const token = claims => `fixture.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.fixture-signature`
  assert.doesNotThrow(() => runner.assertQaServiceKey(token({ role: 'service_role', ref: qa, exp: 9999999999 })))
  for (const key of [token({ role: 'anon', ref: qa }), token({ role: 'service_role', ref: production }), 'sensitive-invalid-credential']) {
    assert.throws(() => runner.assertQaServiceKey(key), error => !error.message.includes(key) && /QA service-role credential/.test(error.message))
  }
})
test('lost upload response is fail-closed, preserves no credential and never invents an ownership receipt', async () => {
  assert.equal(typeof runner.mutateSyntheticAvatar, 'function')
  const m = runner.createManifest(qa)
  const directory=join('output','pedir-tooling',randomUUID());mkdirSync(directory,{recursive:true})
  const fakeKey='fixture.'+Buffer.from(JSON.stringify({role:'service_role',ref:qa,exp:9999999999})).toString('base64url')+'.fixture-signature'
  const labels=[]
  await assert.rejects(runner.mutateSyntheticAvatar(m,directory,'upload',{
    query:async (_ref,_sql,_directory,label)=>{labels.push(label);return [{empty:true}]},
    readKey:async()=>fakeKey,
    clientFactory:()=>({storage:{from:()=>({upload:async()=>{throw new Error('unknown remote timeout '+fakeKey)}})}})
  }),error=>/inspect exact manifest/.test(error.message) && !error.message.includes(fakeKey))
  assert.equal(m.remoteUncertain,true)
  assert.equal(m.apiAvatar,undefined)
  assert.equal(runner.shouldCleanAutomatically(m),false)
  assert.deepEqual(labels,['avatar-empty-before'])
  assert.ok(!readFileSync(join(directory,'manifest.json'),'utf8').includes(fakeKey))
  assert.match(runner.buildStorageOwnershipSql(m),/join auth\.users/)
})
test('failed Storage remove never records absence or clears uncertainty', async () => {
  assert.equal(typeof runner.mutateSyntheticAvatar, 'function')
  const m = runner.createManifest(qa)
  const directory=join('output','pedir-tooling',randomUUID());mkdirSync(directory,{recursive:true})
  const labels=[]
  await assert.rejects(runner.mutateSyntheticAvatar(m,directory,'remove',{
    query:async (_ref,_sql,_directory,label)=>{labels.push(label);return [{object_exists:true}]},
    readKey:async()=> 'fixture.'+Buffer.from(JSON.stringify({role:'service_role',ref:qa,exp:9999999999})).toString('base64url')+'.fixture-signature',
    clientFactory:()=>({storage:{from:()=>({remove:async()=>({error:{message:'network failed'}})})}})
  }),/inspect exact manifest/)
  assert.equal(m.remoteUncertain,true)
  assert.equal(m.avatarRemoved,undefined)
  assert.deepEqual(labels,['avatar-ownership-before'])
})
