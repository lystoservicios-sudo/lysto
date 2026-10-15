/** One manually reconciled QA run only. Inert by default; not an HTTP-test rerun. */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createConnection } from 'node:net'
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { QA_REF, qaCliInvocation, qaSnapshotSql } from './test-customer-request-http-qa.mjs'

export const RECOVERY_RUN = '0f3d5c73-1789-40e2-a240-f45251449195'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const RECOVERY_MANIFEST_PATH = join(ROOT, 'output', 'customer-request-http-qa', `${RECOVERY_RUN}.json`)
const RECEIPT_PATH = join(dirname(RECOVERY_MANIFEST_PATH), `${RECOVERY_RUN}.recovery.json`)
const ORIGINAL_SHA256 = '35cfaa909d8f9412578ec5da694c8e14ed00905fbdb0074a419eaceccb24fc48'
const QA_URL = `https://${QA_REF}.supabase.co`
const ACTORS = [
  { email: `pedir-http-${RECOVERY_RUN}-0@lysto.invalid`, authId: '349189d5-62c3-4787-90fb-127bc484b61a', profileId: '0227349b-882f-412e-8269-76fdfd9e234d', customerId: '79898b8e-0bf2-40bd-a5ce-3bf709fa4422', sessionId: '656034ff-b121-47bc-9eb9-ef222b67963a' },
  { email: `pedir-http-${RECOVERY_RUN}-1@lysto.invalid`, authId: '748c4256-3097-4b75-aae2-2c17b6105ed2', profileId: 'ed366c73-cd98-410f-94af-e1b5f91069a7', customerId: '5d578867-5369-4c88-888d-d76e2940efd0', sessionId: '76dd2287-e061-4d04-a75d-e5a61fac2088' }
]
const RATES = ['private_mutation:526b5fcb1e382dce82423362c9187d43995d79afe7da3e160c9f8a75ce2c3c93', 'private_mutation:903cf10cadb8dbce9e520ce2858ad8f24aa8b76346a7ca9a84cfec3687da1d1a']
const PHASES = new Set(['preflight', 'auth-delete-pending', 'auth-deleted', 'rates-pending', 'rates-cleaned', 'restored', 'recovery-required'])
const fail = () => { throw new Error('qa_recovery_guard_failed') }
const quote = value => `'${value.replace(/'/g, "''")}'`
const list = values => values.map(quote).join(',')

export function parseRecoveryArguments(args) {
  let execute = false, projectRef, manifestPath, reconciledRun
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--execute' && !execute) execute = true
    else if (args[index] === '--qa-ref' && projectRef === undefined) projectRef = args[++index]
    else if (args[index] === '--manifest' && manifestPath === undefined) manifestPath = args[++index]
    else if (args[index] === '--reconciled-run' && reconciledRun === undefined) reconciledRun = args[++index]
    else fail()
  }
  if (projectRef !== undefined && projectRef !== QA_REF || manifestPath !== undefined && resolve(manifestPath) !== RECOVERY_MANIFEST_PATH ||
    reconciledRun !== undefined && reconciledRun !== RECOVERY_RUN || execute &&
    (projectRef !== QA_REF || manifestPath === undefined || reconciledRun !== RECOVERY_RUN)) fail()
  return { mode: execute ? 'execute' : 'dry-run', projectRef: QA_REF, manifestPath: RECOVERY_MANIFEST_PATH, runId: RECOVERY_RUN }
}

export function assertPinnedManifestBytes(bytes) {
  if (createHash('sha256').update(bytes).digest('hex') !== ORIGINAL_SHA256) fail()
}
export function assertRecoveryManifest(manifest) {
  const baseline = manifest?.baseline
  if (manifest?.projectRef !== QA_REF || manifest.runId !== RECOVERY_RUN || manifest.phase !== 'cleanup-required' ||
    !isDeepStrictEqual(manifest.uncertain, ['app-mutation']) || !isDeepStrictEqual(manifest.actors, ACTORS) ||
    !isDeepStrictEqual(manifest.rateKeys, RATES) || baseline?.migrationCount !== 78 || baseline.lastMigration !== '20261014213321' ||
    !Array.isArray(baseline.versions) || baseline.versions.length !== 78 || baseline.writerRoleExists !== false ||
    baseline.quotePolicyId !== null || baseline.requestPolicyEnabled !== false || baseline.counts?.['auth.users'] !== 0 ||
    baseline.counts?.['auth.sessions'] !== 0 || baseline.counts?.['private.rate_limit_buckets'] !== 412 ||
    baseline.rateFingerprint !== '72f3c806dda6d3dda0a139eb5cc2458b' ||
    baseline.permissionsFingerprint !== '0dba5bf87d8da974cfdc2711d7486ab9' || baseline.policyFingerprint !== '3ee440e82d6f796d9c805576f1d130b1') fail()
}

export function assertRecoveryProof(manifest, proof) {
  assertRecoveryManifest(manifest)
  if (proof?.ownedSessions !== 0 || proof.inflightHomeRpc !== 0 || !Number.isSafeInteger(proof.ownedRows) || proof.ownedRows < 0 ||
    !isDeepStrictEqual(proof.normalized, manifest.baseline) || proof.actors?.length !== ACTORS.length) fail()
  for (const [index, expected] of ACTORS.entries()) {
    const current = proof.actors[index]
    if (current.authId !== expected.authId || current.relationsMatch !== true) fail()
    if (current.exists === false) {
      if (['email', 'appRole', 'source', 'runId', 'profileId', 'customerId'].some(name => current[name] !== null)) fail()
    } else if (current.exists !== true || current.email !== expected.email || current.appRole !== 'customer' || current.source !== 'qa_pedir_http' ||
      current.runId !== RECOVERY_RUN || current.profileId !== expected.profileId || current.customerId !== expected.customerId) fail()
  }
}

/** A normalized snapshot excludes only fixture-owned rows; all other rows/configuration remain visible. */
export function recoveryProofSql(manifest) {
  assertRecoveryManifest(manifest)
  const auth = `array[${list(ACTORS.map(actor => actor.authId))}]::uuid[]`
  const profiles = `array[${list(ACTORS.map(actor => actor.profileId))}]::uuid[]`
  const customers = `array[${list(ACTORS.map(actor => actor.customerId))}]::uuid[]`
  const rates = `array[${list(RATES)}]::text[]`
  const excluded = {
    'auth.users': `id = any(${auth})`, 'auth.identities': `user_id = any(${auth})`,
    'auth.refresh_tokens': `user_id = any(array[${list(ACTORS.map(actor => actor.authId))}]::text[])`,
    'public.profiles': `id = any(${profiles})`, 'public.customer_profiles': `id = any(${customers})`,
    'private.customer_registration_acceptances': `auth_user_id = any(${auth})`,
    'private.policy_acceptances': `profile_id = any(${profiles})`,
    ...Object.fromEntries(['public.customer_addresses', 'public.customer_homes', 'public.customer_home_addresses', 'public.customer_home_floors',
      'public.customer_home_rooms', 'public.customer_equipment', 'public.customer_equipment_placements', 'private.customer_home_operations']
      .map(name => [name, `customer_id = any(${customers})`])),
    'private.rate_limit_buckets': `key = any(${rates})`
  }
  const when = Object.entries(excluded).map(([table, filter]) => `when ${quote(table)} then ${quote(filter)}`).join('\n')
  const wanted = ACTORS.map((actor, index) => `(${index},${quote(actor.authId)}::uuid,${quote(actor.profileId)}::uuid,${quote(actor.customerId)}::uuid,${quote(actor.email)})`).join(',')
  return `with raw as (${qaSnapshotSql.trim().replace(/;$/, '')}),
 normalized_counts as (select jsonb_object_agg(n.nspname||'.'||c.relname,
   ((xpath('/row/count/text()',query_to_xml(format('select count(*) as count from %I.%I where (%s) is not true',n.nspname,c.relname,
     case n.nspname||'.'||c.relname ${when} else 'false' end),false,true,'')))[1]::text)::bigint) as counts
   from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p') and
   (n.nspname in('public','private') or n.nspname='auth' and c.relname in('users','sessions','identities','refresh_tokens'))),
 normalized as (select raw.snapshot || jsonb_build_object('counts',normalized_counts.counts,'rateFingerprint',
   (select md5(coalesce(jsonb_agg(to_jsonb(b) order by key),'[]')::text) from private.rate_limit_buckets b where not(key=any(${rates})))) as snapshot,
   (select coalesce(sum((value::text)::bigint-(normalized_counts.counts->>key)::bigint),0)::bigint
     from jsonb_each(raw.snapshot->'counts') where key<>'private.rate_limit_buckets') as owned_rows from raw cross join normalized_counts),
 wanted(ordinal,auth_id,profile_id,customer_id,email) as (values ${wanted})
 select jsonb_build_object('normalized',normalized.snapshot,'ownedRows',normalized.owned_rows,
  'ownedSessions',(select count(*) from auth.sessions where user_id=any(${auth})),
  'inflightHomeRpc',(select count(*) from pg_stat_activity where pid<>pg_backend_pid() and datname=current_database()
    and backend_type='client backend' and state is distinct from 'idle' and
    (query ilike '%customer_home%' or query ilike '%customer_equipment%' or query ilike '%complete_customer_registration%')),
  'actors',(select jsonb_agg(jsonb_build_object('authId',w.auth_id,'exists',u.id is not null,'email',u.email,
    'appRole',u.raw_app_meta_data->>'app_role','source',u.raw_app_meta_data->>'signup_source','runId',u.raw_app_meta_data->>'qa_pedir_http_run',
    'profileId',p.id,'customerId',c.id,'relationsMatch',case when u.id is null then p.id is null and c.id is null
      else p.auth_user_id=u.id and p.role='customer' and p.email::text=w.email and c.profile_id=p.id end) order by w.ordinal)
    from wanted w left join auth.users u on u.id=w.auth_id left join public.profiles p on p.id=w.profile_id left join public.customer_profiles c on c.id=w.customer_id))
 as proof from normalized;`
}

export function assertRecoveryServiceKey(value) {
  try {
    if (typeof value !== 'string' || value.split('.').length !== 3) fail()
    const [header, payload] = value.split('.')
    const alg = JSON.parse(Buffer.from(header, 'base64url').toString('utf8')).alg
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!['HS256', 'ES256', 'RS256'].includes(alg) || claims.ref !== QA_REF || claims.role !== 'service_role' ||
      !Number.isSafeInteger(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000) + 60) fail()
    return value
  } catch { fail() }
}
export function boundedRecoveryFetch(fetcher = globalThis.fetch) {
  return async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input)), method = init.method ?? (input instanceof Request ? input.method : 'GET')
    if (url.origin !== QA_URL || url.username || url.password || url.hash || url.search || !['GET', 'DELETE'].includes(method) ||
      !ACTORS.some(actor => url.pathname === `/auth/v1/admin/users/${actor.authId}`)) fail()
    try {
      const parentSignal = init.signal ?? (input instanceof Request ? input.signal : undefined)
      const signal = parentSignal ? AbortSignal.any([parentSignal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)
      const response = await fetcher(input, { ...init, signal, redirect: 'error' })
      const bytes = await response.arrayBuffer()
      if (bytes.byteLength > 2_000_000) fail()
      return new Response([204, 205, 304].includes(response.status) ? null : bytes, { status: response.status, headers: response.headers })
    } catch { throw new Error('qa_recovery_transport_failed') }
  }
}
function verifyApiIdentity(actor, data) {
  if (data?.user?.id !== actor.authId || data.user.email !== actor.email || data.user.app_metadata?.app_role !== 'customer' ||
    data.user.app_metadata?.signup_source !== 'qa_pedir_http' || data.user.app_metadata?.qa_pedir_http_run !== RECOVERY_RUN) fail()
}
export function publicRecoveryReceipt(state) {
  if (!PHASES.has(state.phase) || state.pending !== null && state.pending !== undefined && state.pending !== 'rate-keys' &&
    !ACTORS.some(actor => actor.authId === state.pending) || !Array.isArray(state.deleted) || state.deleted.some(id => !ACTORS.some(actor => actor.authId === id))) fail()
  return { projectRef: QA_REF, runId: RECOVERY_RUN, originalSha256: ORIGINAL_SHA256, originalUncertain: ['app-mutation'],
    phase: state.phase, pending: state.pending ?? null, deleted: [...new Set(state.deleted)],
    ...(state.after === undefined ? {} : { after: state.after }), updatedAt: new Date().toISOString() }
}

export function recoveryRateCleanupSql(manifest) {
  assertRecoveryManifest(manifest)
  const proof = recoveryProofSql(manifest).trim().replace(/;$/, ''), baseline = `${quote(JSON.stringify(manifest.baseline))}::jsonb`
  return `begin; set local lock_timeout='5s'; set local statement_timeout='20s';
lock table private.rate_limit_buckets in share row exclusive mode;
do $qa_recovery$ declare qa_recovery_before jsonb; qa_recovery_after jsonb; begin
 select q.proof into qa_recovery_before from (${proof}) q;
 if (qa_recovery_before->>'ownedRows')::bigint<>0 or (qa_recovery_before->>'ownedSessions')::bigint<>0 or
   exists(select 1 from jsonb_array_elements(qa_recovery_before->'actors') actor where (actor->>'exists')::boolean) then
   raise exception using errcode='P0001',message='qa_recovery_owned_actor_present'; end if;
 if (qa_recovery_before->>'inflightHomeRpc')::bigint<>0 or qa_recovery_before->'normalized' is distinct from ${baseline} then
   raise exception using errcode='P0001',message='qa_recovery_baseline_changed'; end if;
 delete from private.rate_limit_buckets where key = any(array[${list(RATES)}]::text[]);
 select s.snapshot into qa_recovery_after from (${qaSnapshotSql.trim().replace(/;$/, '')}) s;
 if qa_recovery_after is distinct from ${baseline} then raise exception using errcode='P0001',message='qa_recovery_baseline_changed'; end if;
end $qa_recovery$; commit; select 1 as cleaned;`
}

/** Dependency injection is only for local tests. CLI main below supplies fixed real QA transports. */
export async function recoverOwnedQaRun(manifest, { assertPortClosed, query, readServiceKey, clientFactory, snapshot, record }) {
  assertRecoveryManifest(manifest)
  const state = { phase: 'preflight', pending: null, deleted: [] }
  const save = phase => { state.phase = phase; record(publicRecoveryReceipt(state)) }
  const freshProof = async () => {
    await assertPortClosed()
    const current = (await query(recoveryProofSql(manifest))).proof
    assertRecoveryProof(manifest, current)
    if (state.deleted.some(id => current.actors.find(actor => actor.authId === id)?.exists !== false)) fail()
    return current
  }
  save('preflight')
  try {
    await freshProof()
    const key = assertRecoveryServiceKey(await readServiceKey())
    const client = await clientFactory(QA_URL, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: boundedRecoveryFetch() } })
    for (const actor of ACTORS) {
      const current = await freshProof(), owned = current.actors.find(row => row.authId === actor.authId)
      const lookup = await client.auth.admin.getUserById(actor.authId)
      if (lookup.error?.status === 404 && owned.exists === false) { state.deleted.push(actor.authId); save('auth-deleted'); continue }
      if (lookup.error || owned.exists !== true) fail()
      verifyApiIdentity(actor, lookup.data)
      state.pending = actor.authId; save('auth-delete-pending')
      const deleted = await client.auth.admin.deleteUser(actor.authId)
      // The installed Auth SDK documents successful DELETE as user:{}.
      // A response is not proof of deletion; independently confirm absence before continuing.
      if (deleted?.error !== null || deleted.data?.user?.id !== undefined && deleted.data.user.id !== actor.authId) fail()
      const absence = await freshProof()
      if (absence.actors.find(current => current.authId === actor.authId)?.exists !== false) fail()
      state.pending = null; state.deleted.push(actor.authId); save('auth-deleted')
    }
    const finalProof = await freshProof()
    if (finalProof.ownedRows !== 0 || finalProof.actors.some(actor => actor.exists)) fail()
    state.pending = 'rate-keys'; save('rates-pending')
    if ((await query(recoveryRateCleanupSql(manifest))).cleaned !== 1) fail()
    state.pending = null; save('rates-cleaned')
    state.after = await snapshot()
    if (!isDeepStrictEqual(state.after, manifest.baseline)) fail()
    save('restored')
    return publicRecoveryReceipt(state)
  } catch {
    save('recovery-required')
    throw new Error('qa_recovery_failed_inspect_separate_receipt')
  }
}

function runCli(args, help = false) {
  const invocation = qaCliInvocation(args)
  const result = spawnSync(invocation.command, invocation.args, invocation.options)
  if (result.error || result.status !== 0) throw new Error('qa_recovery_cli_failed')
  if (help) return
  try { return JSON.parse(result.stdout) } catch { throw new Error('qa_recovery_cli_json_failed') }
}
function queryQa(sql) {
  const directory = mkdtempSync(join(tmpdir(), 'lysto-pedir-owned-recovery-')), file = join(directory, 'query.sql')
  try {
    writeFileSync(file, sql, { encoding: 'utf8', flag: 'wx' })
    const result = runCli(['db', 'query', '--linked', '--project-ref', QA_REF, '--file', file, '--output', 'json'])
    if (!Array.isArray(result) || result.length !== 1) fail()
    return result[0]
  } finally { unlinkSync(file); rmdirSync(directory) }
}
function assertPortClosed() {
  return new Promise((done, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port: 3175 })
    const denied = () => { socket.destroy(); reject(new Error('qa_recovery_owned_port_not_quiescent')) }
    socket.setTimeout(2000, denied)
    socket.once('connect', denied)
    socket.once('error', error => { socket.destroy(); if (error.code === 'ECONNREFUSED') done(); else reject(new Error('qa_recovery_owned_port_unverified')) })
  })
}
export async function main(args = process.argv.slice(2)) {
  const config = parseRecoveryArguments(args)
  if (config.mode === 'dry-run') return { mode: 'dry-run', projectRef: QA_REF, runId: RECOVERY_RUN,
    scope: 'Manually reconciled owned Auth recovery only; original HTTP outcome remains uncertain.',
    manifestPath: RECOVERY_MANIFEST_PATH, receiptPath: RECEIPT_PATH,
    executeArguments: ['--execute', '--qa-ref', QA_REF, '--manifest', RECOVERY_MANIFEST_PATH, '--reconciled-run', RECOVERY_RUN] }
  if (process.platform !== 'win32') fail()
  const bytes = readFileSync(RECOVERY_MANIFEST_PATH); assertPinnedManifestBytes(bytes)
  let manifest
  try { manifest = JSON.parse(bytes.toString('utf8')) } catch { fail() }
  assertRecoveryManifest(manifest)
  runCli(['db', 'query', '--help'], true); runCli(['projects', 'api-keys', '--help'], true)
  return recoverOwnedQaRun(manifest, {
    assertPortClosed, query: queryQa,
    readServiceKey: async () => {
      const values = runCli(['projects', 'api-keys', '--project-ref', QA_REF, '--reveal', '--output', 'json'])
      if (!Array.isArray(values)) fail()
      return assertRecoveryServiceKey(values.find(value => value.name === 'service_role')?.api_key)
    },
    clientFactory: async (...options) => { const { createClient } = await import('@supabase/supabase-js'); return createClient(...options) },
    snapshot: async () => queryQa(qaSnapshotSql).snapshot,
    record: receipt => writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2) + '\n', { encoding: 'utf8' })
  })
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().then(result => console.log(JSON.stringify(result, null, 2))).catch(() => {
    console.error('Owned QA recovery stopped. Inspect the separate non-secret receipt; original HTTP outcome is unchanged.')
    process.exitCode = 1
  })
}
