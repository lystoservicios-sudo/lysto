import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

const expected = [
  ['private.write_customer_home(text,uuid,integer,jsonb)', 4, ['73ebec552dde32236d0f455ea8b7f2cf', 'a7c8006f61e2a4c825312842f85c736f']],
  ['private.write_customer_asset_before_hogar(text,uuid,integer,jsonb,boolean)', 4, ['42bc64bcb4b1691d625a61d185a32f4c']],
  ['private.customer_request_context_snapshot(uuid,jsonb)', 3, ['52c4142e70bec7463c544fa83cd4c5ad']],
  ['private.persist_customer_request_preview(uuid,uuid,uuid,jsonb)', 1, ['46964363ec4ff05d223d64f5c6e19cf3']],
  ['private.prepare_customer_request(uuid,uuid,uuid,uuid,uuid)', 2, ['0c39ef0e16e80dd93b53c6de8d0e622f']],
  ['private.read_customer_request_preview(uuid,uuid,uuid,uuid,uuid)', 1, ['c58824985bb83bad4295aed8aa2dd31e']],
  ['private.configure_customer_request_contract(uuid,jsonb,timestamp with time zone,integer,text,boolean)', 1, ['81fc3e3e2605311d11faad5f5de8ef1c']]
]
function migration() {
  const names = readdirSync('supabase/migrations').filter(name => name.endsWith('_customer_rpc_business_conflicts.sql'))
  assert.equal(names.length, 1, 'A single new durable business-conflict migration is required')
  return readFileSync(`supabase/migrations/${names[0]}`, 'utf8')
}
function scope(sql) {
  const match = sql.match(/\$targets\$([\s\S]*?)\$targets\$::jsonb/)
  assert.ok(match, 'Migration must expose its exact reviewable function allowlist')
  return JSON.parse(match[1])
}

test('new migration targets only seven approved private signatures and sixteen deliberate business conflicts', () => {
  const actual = scope(migration())
  assert.deepEqual(actual.map(item => [item.signature, item.manualCount, item.preimages]), expected)
  assert.equal(actual.reduce((sum, item) => sum + item.manualCount, 0), 16)
  assert.ok(actual.every(item => item.signature.startsWith('private.')))
})

test('migration requires exact preimages and counts before replacing only explicit manual errcode assignments', () => {
  const sql = migration()
  assert.match(sql, /md5\(v_definition\)/)
  assert.match(sql, /jsonb_array_elements_text\(v_target\.preimages\)/)
  assert.match(sql, /v_count<>v_target\."manualCount"/)
  assert.match(sql, /errcode\[\[:space:\]\]\*=\[\[:space:\]\]\*''40001''/)
  assert.match(sql, /regexp_replace\(v_definition,v_pattern,'errcode=''PT409''','g'\)/)
  assert.doesNotMatch(sql, /replace\([^\n]+,'40001','PT409'\)/)
  assert.doesNotMatch(sql, /^\s*(?:grant|revoke|alter\s+(?:role|table|policy)|update\s+(?:public|private)\.|delete\s+from|drop\s+)/im)
})

test('replacement preserves exact source remainder, OIDs and semantic function metadata and excludes non-target changes', () => {
  const sql = migration()
  assert.match(sql, /to_regprocedure\(v_target\.signature\)/)
  assert.match(sql, /to_regprocedure\(v_target\.signature\)::oid is distinct from v_oid/)
  assert.match(sql, /pg_get_functiondef\(v_oid\) is distinct from v_expected_definition/)
  assert.match(sql, /v_after\.prosrc is distinct from v_expected_source/)
  assert.match(sql, /\(to_jsonb\(v_after\)-'prosrc'-'proargdefaults'\) is distinct from \(to_jsonb\(v_before\)-'prosrc'-'proargdefaults'\)/)
  assert.match(sql, /regexp_replace\(v_after\.proargdefaults::text,\s*':location -\?\[0-9\]\+', ':location -1', 'g'\)/)
  assert.match(sql, /regexp_replace\(v_before\.proargdefaults::text,\s*':location -\?\[0-9\]\+', ':location -1', 'g'\)/)
  assert.match(sql, /pg_get_expr\(v_after\.proargdefaults,0\) is distinct from pg_get_expr\(v_before\.proargdefaults,0\)/)
  assert.match(sql, /v_non_target_after is distinct from v_non_target_before/)
  assert.match(sql, /not\(p\.oid=any\(v_target_oids\)\)/)
  assert.match(sql, /v_security_after is distinct from v_security_before/)
  assert.match(sql, /pg_policies/)
  assert.doesNotMatch(sql, /exception when serialization_failure/i)
})

test('Postgres 15 default metadata ignores only parser positions, not default expressions', () => {
  const sql = migration()
  const normalizers = [...sql.matchAll(/regexp_replace\(v_(?:after|before)\.proargdefaults::text,\s*'([^']+)', '([^']+)', 'g'\)/g)]
  assert.equal(normalizers.length, 2, 'Both defaults must be checked with the same narrow normalization')
  const normalize = value => value === null ? null : value.replace(new RegExp(normalizers[0][1], 'g'), normalizers[0][2])
  assert.equal(normalizers[0][1], normalizers[1][1])
  assert.equal(normalizers[0][2], normalizers[1][2])
  const before = '({CONST :consttype 16 :constvalue 1 [ 0 ] :location 220})'
  assert.equal(normalize(before), normalize(before.replace('220', '161')))
  assert.equal(normalize(before), normalize(before.replace('220', '-1')))
  assert.notEqual(normalize(before), normalize(before.replace('[ 0 ]', '[ 1 ]')))
  assert.notEqual(normalize(before), normalize(before.replace(':consttype 16', ':consttype 23')))
  assert.notEqual(normalize(before), normalize(null))
})

test('rollback harnesses expect PT409 business conflicts rather than serialization retry signals', () => {
  const request = readFileSync('supabase/tests/customer_request_contract_rollback.sql', 'utf8')
  const home = readFileSync('supabase/tests/hogar_rollback.sql', 'utf8')
  assert.equal((request.match(/'PT409'/g) ?? []).length, 3)
  assert.doesNotMatch(request, /'40001'/)
  assert.match(home, /exception when sqlstate 'PT409' then rejected:=true/)
  assert.doesNotMatch(home, /exception when serialization_failure then rejected:=true/)
})
