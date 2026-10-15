/** Partial real Auth/HTTP smoke only. Default invocation/import is inert.
 * Not a payment, browser, visual, Google Routes, or full external E2E acceptance.
 * Root must review this source before authorizing --execute. No production target exists.
 */
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { spawn, spawnSync, execFile } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const QA_REF = 'obksyzasmfwcbbksesqt'
const QA_URL = `https://${QA_REF}.supabase.co`
const CLI_WRAPPER = 'E:\\Proyectos\\GitHub\\Lysto\\scripts\\supabase-lysto.cmd'
const REQUIRED_VERSIONS = ['20261004011254', '20261013141601', '20261014023946', '20261014213321', '20261014235503']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const RATE_KEY = /^private_mutation:[a-f0-9]{64}$/
const RATE_SECRET = 'lysto-http-qa-synthetic-rate-limit-key-not-a-production-secret'
const PHASES = new Set(['preflight', 'fixtures-created', 'server-starting', 'http-checks', 'stopping-server', 'cleanup', 'cleaned', 'cleanup-required'])
const API_ERROR_CODES = new Set(['address_has_home', 'last_owner', 'unauthorized', 'forbidden', 'mfa_required', 'not_found', 'invalid_input',
  'conflict', 'upload_expired', 'feature_unavailable', 'session_unavailable', 'service_unavailable'])
const EMPTY_TABLES = ['auth.users', 'auth.sessions', 'auth.identities', 'auth.refresh_tokens', 'public.profiles', 'public.customer_profiles',
  'public.customer_homes', 'public.customer_home_addresses', 'public.customer_home_floors', 'public.customer_home_rooms',
  'public.customer_equipment', 'public.customer_equipment_placements', 'public.customer_addresses', 'private.customer_home_operations',
  'private.customer_registration_acceptances', 'private.policy_acceptances', 'public.jobs', 'public.service_requests', 'public.service_quotes',
  'public.marketplace_checkouts', 'public.payments', 'private.customer_request_previews', 'private.customer_request_contracts',
  'private.outbox_events', 'public.admin_audit_logs']
const OS_ENV = ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'ComSpec', 'COMSPEC', 'TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE']
const osEnvironment = parent => Object.fromEntries(OS_ENV.filter(name => typeof parent[name] === 'string').map(name => [name, parent[name]]))
const fail = () => { throw new Error('qa_http_guard_failed') }
function assertOrigin(value) {
  let url
  try { url = new URL(value) } catch { fail() }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !/^\d+$/.test(url.port) || Number(url.port) < 1024 || Number(url.port) > 65535 ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.origin !== value) fail()
  return url
}
export function parseQaArguments(args) {
  let execute = false, projectRef, origin
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--execute' && !execute) execute = true
    else if (args[i] === '--qa-ref' && projectRef === undefined) projectRef = args[++i]
    else if (args[i] === '--origin' && origin === undefined) origin = args[++i]
    else fail()
  }
  if (projectRef !== undefined && projectRef !== QA_REF) fail()
  if (origin !== undefined) assertOrigin(origin)
  if (execute && (projectRef !== QA_REF || !origin)) fail()
  return { mode: execute ? 'execute' : 'dry-run', projectRef: QA_REF, origin }
}
function claims(value) {
  try {
    if (typeof value !== 'string' || value.split('.').length !== 3) fail()
    const [header, payload] = value.split('.')
    const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'))
    if (!['HS256', 'ES256', 'RS256'].includes(parsedHeader.alg)) fail()
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch { fail() }
}
/** Sanity-check actual CLI-returned keys. This does not manufacture or authenticate JWTs. */
export function assertQaKeys(keys) {
  for (const [slot, role] of [['anon', 'anon'], ['service', 'service_role']]) {
    const jwt = claims(keys?.[slot])
    if (jwt.ref !== QA_REF || jwt.role !== role || !Number.isSafeInteger(jwt.exp) || jwt.exp <= Math.floor(Date.now() / 1000) + 60) fail()
  }
  return { anon: keys.anon, service: keys.service }
}
export function assertNoQaDotenv(names) {
  if (names.some(name => name !== '.env.example' && (name === '.env' || name.startsWith('.env.')))) throw new Error('qa_http_dotenv_forbidden')
}
export function createQaChildEnvironment({ origin, keys, parent = process.env }) {
  assertOrigin(origin); assertQaKeys(keys)
  return { ...osEnvironment(parent), NODE_ENV: 'development', APP_ENV: 'test', NEXT_PUBLIC_APP_URL: origin,
    NEXT_PUBLIC_SUPABASE_URL: QA_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anon, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: keys.anon,
    SUPABASE_SERVICE_ROLE_KEY: keys.service, RATE_LIMIT_HASH_KEY: RATE_SECRET, PAYMENTS_PROVIDER: 'mock', MERCADOPAGO_MODE: 'test',
    LYSTO_ACCEPT_NEW_REQUESTS: 'true', LYSTO_ALLOW_NEW_CHECKOUTS: 'false', NOTIFICATIONS_EMAIL_ENABLED: 'false',
    OUTBOX_WORKER_ENABLED: 'false', REFUND_WORKER_ENABLED: 'false', AI_ENABLED: 'false', WHATSAPP_ENABLED: 'false',
    NEXT_TELEMETRY_DISABLED: '1', LYSTO_BUILD_DIR: '.next-pedir-http-qa' }
}
export function assertQaBaseline(state) {
  if (state?.migrationCount !== 79 || state.lastMigration !== REQUIRED_VERSIONS.at(-1) || state.writerRoleExists !== false ||
    state.quotePolicyId !== null || state.requestPolicyEnabled !== false ||
    !REQUIRED_VERSIONS.every(version => state.versions?.includes(version)) ||
    !EMPTY_TABLES.every(name => state.counts?.[name] === 0) ||
    state.counts?.['private.rate_limit_buckets'] !== 412 || state.rateFingerprint !== '72f3c806dda6d3dda0a139eb5cc2458b' ||
    !/^[a-f0-9]{32}$/.test(state.policyFingerprint ?? '') || !/^[a-f0-9]{32}$/.test(state.permissionsFingerprint ?? '')) fail()
}
export function safeQaHttpFailure({ check, kind, status, cacheProtected, apiErrorCode, loginToRequestDurationMs, jwtRemainingSeconds }) {
  if (!/^[a-z][a-z-]{1,64}$/.test(check ?? '') || !['transport', 'status', 'cache', 'json'].includes(kind) ||
    (status !== undefined && (!Number.isInteger(status) || status < 100 || status > 599)) ||
    (cacheProtected !== undefined && typeof cacheProtected !== 'boolean') ||
    (loginToRequestDurationMs !== undefined && (!Number.isSafeInteger(loginToRequestDurationMs) || loginToRequestDurationMs < 0)) ||
    (jwtRemainingSeconds !== undefined && !Number.isSafeInteger(jwtRemainingSeconds))) fail()
  return { check, kind, ...(status === undefined ? {} : { status }), ...(cacheProtected === undefined ? {} : { cacheProtected }),
    ...(API_ERROR_CODES.has(apiErrorCode) ? { apiErrorCode } : {}),
    ...(loginToRequestDurationMs === undefined ? {} : { loginToRequestDurationMs }),
    ...(jwtRemainingSeconds === undefined ? {} : { jwtRemainingSeconds }) }
}
export function safeQaJwtTiming({ iat, exp }) {
  if (!Number.isSafeInteger(iat) || iat < 0 || !Number.isSafeInteger(exp) || exp <= iat) fail()
  return { iat, exp, ttlSeconds: exp - iat }
}
export function safeQaSessionRevocation({ logout, proof, remainingSessions }) {
  if (!Array.isArray(logout) || logout.length > 2 || logout.some(value => !['success', 'error', 'thrown', 'missing-token'].includes(value)) ||
    !['zero', 'remaining', 'unavailable', 'invalid'].includes(proof) ||
    (remainingSessions !== undefined && (!Number.isSafeInteger(remainingSessions) || remainingSessions < 0))) fail()
  return { logout: [...logout], proof, ...(remainingSessions === undefined ? {} : { remainingSessions }) }
}
export function assertQaRestored(before, after, uncertain) {
  assertQaBaseline(after)
  if (uncertain.length || JSON.stringify(before) !== JSON.stringify(after)) fail()
}
export function publicManifest(state) {
  if (!UUID.test(state.runId ?? '') || state.projectRef !== QA_REF || !PHASES.has(state.phase) || (state.actors?.length ?? 0) > 2) fail()
  const actors = (state.actors ?? []).map(actor => {
    if (actor.email !== undefined && ![0, 1].some(index => actor.email === `pedir-http-${state.runId}-${index}@lysto.invalid`)) fail()
    return { ...(actor.email === undefined ? {} : { email: actor.email }),
      ...(actor.jwtTiming === undefined ? {} : { jwtTiming: safeQaJwtTiming(actor.jwtTiming) }), ...Object.fromEntries(['authId', 'profileId', 'customerId', 'sessionId'].flatMap(name => {
    if (actor[name] === undefined) return []
    if (!UUID.test(actor[name])) fail()
    return [[name, actor[name]]]
    })) }
  })
  const rateKeys = [...new Set(state.rateKeys ?? [])]
  if (rateKeys.length > 2 || rateKeys.some(key => !RATE_KEY.test(key))) fail()
  const uncertain = state.uncertain ?? []
  if (uncertain.some(code => !/^[a-z_-]{1,60}$/.test(code))) fail()
  if (state.nextReadyDurationMs !== undefined && (!Number.isSafeInteger(state.nextReadyDurationMs) || state.nextReadyDurationMs < 0)) fail()
  return { projectRef: QA_REF, runId: state.runId, phase: state.phase, actors, rateKeys, uncertain,
    baseline: state.baseline, after: state.after, checks: state.checks ?? [], sourceFilesChanged: state.sourceFilesChanged ?? [],
    ...(state.failure === undefined ? {} : { failure: safeQaHttpFailure(state.failure) }),
    ...(state.nextReadyDurationMs === undefined ? {} : { nextReadyDurationMs: state.nextReadyDurationMs }),
    ...(state.sessionRevocation === undefined ? {} : { sessionRevocation: safeQaSessionRevocation(state.sessionRevocation) }),
    updatedAt: new Date().toISOString() }
}
export function ownedActorAbsenceSql(actor) {
  if (!UUID.test(actor.authId ?? '') || ['profileId', 'customerId', 'sessionId'].some(key => actor[key] !== undefined && !UUID.test(actor[key]))) fail()
  const literal = id => `'${id}'::uuid`
  const auth = literal(actor.authId)
  const profile = actor.profileId === undefined ? 'false' : `p.id=${literal(actor.profileId)}`
  const customer = actor.customerId === undefined ? 'false' : `c.id=${literal(actor.customerId)}`
  const customerProfile = actor.profileId === undefined ? 'false' : `c.profile_id=${literal(actor.profileId)}`
  const session = actor.sessionId === undefined ? 'false' : `s.id=${literal(actor.sessionId)}`
  return `select jsonb_build_object(
    'users',(select count(*)::integer from auth.users u where u.id=${auth}),
    'profiles',(select count(*)::integer from public.profiles p where p.auth_user_id=${auth} or ${profile}),
    'customers',(select count(*)::integer from public.customer_profiles c where ${customer} or ${customerProfile} or c.profile_id in(select p.id from public.profiles p where p.auth_user_id=${auth})),
    'sessions',(select count(*)::integer from auth.sessions s where s.user_id=${auth} or ${session})
  ) as remaining;`
}
function assertQaActorAbsent(proof) {
  if (!['users', 'profiles', 'customers', 'sessions'].every(key => proof?.[key] === 0)) throw new Error('qa_http_identity_absence_unverified')
}
export async function verifyQaActorDeleted(actor, result, inspectRemaining) {
  if (!UUID.test(actor.authId ?? '') || result?.error !== null ||
    (result.data?.user?.id !== undefined && result.data.user.id !== actor.authId)) throw new Error('qa_http_identity_cleanup_failed')
  assertQaActorAbsent(await inspectRemaining(actor))
}
export function ownedRateCleanupSql(keys) {
  if (keys.length > 2 || keys.some(key => !RATE_KEY.test(key))) fail()
  return `begin; set local lock_timeout='5s'; set local statement_timeout='15s';
delete from private.rate_limit_buckets where key = any(array[${[...new Set(keys)].map(key => `'${key}'`).join(',')}]::text[]);
commit; select 1 as cleaned;`
}
export function boundedQaFetch({ origin, fetcher = globalThis.fetch }) {
  assertOrigin(origin)
  return async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const qaPath = /^\/auth\/v1\/(admin\/users(?:\/[0-9a-f-]{36})?|token|user|logout|settings|\.well-known\/jwks\.json)$/.test(url.pathname) ||
      /^\/rest\/v1\/rpc\/(get_registration_policy|complete_customer_registration|get_session_context)$/.test(url.pathname)
    const appPath = ['/api/health/live', '/api/customer/homes', '/api/customer/homes/equipment', '/api/customer/requests/preview'].includes(url.pathname)
    if (url.username || url.password || url.hash || !(url.origin === QA_URL && qaPath || url.origin === origin && appPath)) fail()
    const sourceSignal = init.signal ?? (input instanceof Request ? input.signal : undefined)
    const signal = sourceSignal ? AbortSignal.any([sourceSignal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)
    let response
    try {
      response = await fetcher(input, { ...init, redirect: 'error', signal })
      const bytes = await response.arrayBuffer()
      if (bytes.byteLength > 2_000_000) fail()
      return new Response([101, 204, 205, 304].includes(response.status) ? null : bytes, { status: response.status, headers: response.headers })
    } catch { throw new Error('qa_http_transport_failed') }
  }
}

/** Read-only evidence, no row contents from Auth/credentials. Full public/private row counts compare before/after. */
export const qaSnapshotSql = `select jsonb_build_object(
 'migrationCount',(select count(*) from supabase_migrations.schema_migrations),
 'lastMigration',(select max(version) from supabase_migrations.schema_migrations),
 'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'writerRoleExists',to_regrole('lysto_marketplace') is not null,
 'quotePolicyId',(select policy_id from private.quote_policy_current where singleton),
 'requestPolicyEnabled',(select enabled from private.customer_request_policy_current where singleton),
 'rateFingerprint',(select md5(coalesce(jsonb_agg(to_jsonb(b) order by key),'[]')::text) from private.rate_limit_buckets b),
 'counts',(select jsonb_object_agg(n.nspname||'.'||c.relname,
   ((xpath('/row/count/text()',query_to_xml(format('select count(*) as count from %I.%I',n.nspname,c.relname),false,true,'')))[1]::text)::bigint)
   from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p') and
   (n.nspname in('public','private') or n.nspname='auth' and c.relname in('users','sessions','identities','refresh_tokens'))),
 'policyFingerprint',md5(concat(
   (select coalesce(jsonb_agg(to_jsonb(p) order by singleton),'[]')::text from private.account_registration_policy p),
   (select coalesce(jsonb_agg(to_jsonb(p) order by kind,version),'[]')::text from private.account_legal_documents p),
   (select coalesce(jsonb_agg(to_jsonb(p) order by singleton),'[]')::text from private.customer_request_policy_current p),
   (select coalesce(jsonb_agg(to_jsonb(p) order by singleton),'[]')::text from private.quote_policy_current p))),
 'permissionsFingerprint',md5(concat(
   (select coalesce(jsonb_agg(jsonb_build_array(n.nspname,p.proname,p.proargtypes::text,p.proowner,p.proacl::text,p.prosecdef,p.proconfig) order by n.nspname,p.proname,p.proargtypes::text),'[]')::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private')),
   (select coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity) order by n.nspname,c.relname),'[]')::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private')),
   (select coalesce(jsonb_agg(jsonb_build_array(rolname,rolsuper,rolcreaterole,rolcreatedb,rolcanlogin,rolbypassrls) order by rolname),'[]')::text from pg_roles),
   (select coalesce(jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname),'[]')::text from pg_policies p where schemaname in('public','private')),
   (select coalesce(jsonb_agg(to_jsonb(m) order by roleid,member,grantor),'[]')::text from pg_auth_members m)))
) as snapshot;`

export function qaCliInvocation(args) {
  // Proven Windows launcher: separate argv, never a nested cmd expression. No secrets in argv/stdout logs.
  if (args.some(value => /[\r\n"&|<>^%!]/.test(value))) fail()
  return { command: process.env.ComSpec ?? 'cmd.exe', args: ['/d', '/c', CLI_WRAPPER, ...args], options: {
    env: osEnvironment(process.env), windowsHide: true, encoding: 'utf8', timeout: 60000, maxBuffer: 2_000_000, stdio: ['ignore', 'pipe', 'pipe'] } }
}
function cli(args) {
  const invocation = qaCliInvocation(args)
  const result = spawnSync(invocation.command, invocation.args, invocation.options)
  if (result.error || result.status !== 0) throw new Error('qa_http_cli_failed')
  try { return JSON.parse(result.stdout) } catch { throw new Error('qa_http_cli_json_failed') }
}
function cliHelp(args) {
  const invocation = qaCliInvocation([...args, '--help'])
  const result = spawnSync(invocation.command, invocation.args, { ...invocation.options, timeout: 30000 })
  if (result.error || result.status !== 0) throw new Error('qa_http_cli_help_failed')
}
function queryQa(sql) {
  const directory = mkdtempSync(join(tmpdir(), 'lysto-pedir-http-qa-sql-')), file = join(directory, 'query.sql')
  try {
    writeFileSync(file, sql, { encoding: 'utf8', flag: 'wx' })
    const result = cli(['db', 'query', '--linked', '--project-ref', QA_REF, '--file', file, '--output', 'json'])
    if (!Array.isArray(result) || result.length !== 1) fail()
    return result[0]
  } finally {
    // Only exact files/directories created above, never recursive or a computed broad target.
    unlinkSync(file); rmdirSync(directory)
  }
}
export async function startOwnedQaApp({ spawnOwned, retain, waitReady }) {
  const owned = spawnOwned()
  retain(owned)
  await waitReady(owned)
  return owned
}
export async function quiesceBeforeQaCleanup(state) {
  try { if (state.app) await state.app.stop() }
  catch { state.uncertain.push('server-stop'); return false }
  return state.uncertain.length === 0
}
export async function verifyQaSessionRevocation(actors, verifySessions, revokeActor, report = () => {}) {
  const logout = []
  for (const actor of actors) {
    if (!actor.logoutAccessToken) { logout.push('missing-token'); continue }
    try {
      // The verified login JWT is RAM-only and independent of cookies changed by an app response.
      const result = await revokeActor(actor)
      logout.push(result?.error === null ? 'success' : 'error')
    } catch { logout.push('thrown') }
  }
  let count
  try { count = await verifySessions(actors) }
  catch { report(safeQaSessionRevocation({ logout, proof: 'unavailable' })); throw new Error('qa_http_session_proof_unavailable') }
  if (!Number.isSafeInteger(count) || count < 0) {
    report(safeQaSessionRevocation({ logout, proof: 'invalid' })); throw new Error('qa_http_session_proof_invalid')
  }
  report(safeQaSessionRevocation({ logout, proof: count === 0 ? 'zero' : 'remaining', remainingSessions: count }))
  if (count !== 0) throw new Error('qa_http_session_proof_remaining')
}
export async function cleanupOwnedQaFixtures(state, { deleteActor, deleteRates }) {
  if (state.uncertain.length) return false
  for (const actor of [...state.actors].reverse()) {
    try { await deleteActor(actor) }
    catch { state.uncertain.push('auth-cleanup'); return false }
  }
  try { if (state.rateKeys.length) await deleteRates(state.rateKeys) }
  catch { state.uncertain.push('rate-cleanup'); return false }
  return true
}
async function startApp(cwd, environment, http, retain) {
  const url = assertOrigin(environment.NEXT_PUBLIC_APP_URL), check = createServer()
  await new Promise((ready, reject) => { check.once('error', reject); check.listen(Number(url.port), url.hostname, () => check.close(ready)) })
  assertNoQaDotenv(readdirSync(cwd))
  const require = createRequire(import.meta.url)
  let child
  let launchFailed = false
  const stop = async () => {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) return
    const exited = once(child, 'exit')
    if (process.platform === 'win32') await new Promise((done, reject) => execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, error => error ? reject(new Error('qa_http_server_stop_failed')) : done()))
    else process.kill(-child.pid, 'SIGTERM')
    await Promise.race([exited, new Promise((_, reject) => setTimeout(() => reject(new Error('qa_http_server_stop_timeout')), 10000))])
  }
  return startOwnedQaApp({ retain, spawnOwned: () => {
    child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', url.port],
      { cwd, env: environment, windowsHide: true, stdio: 'ignore', detached: process.platform !== 'win32' })
    child.once('error', () => { launchFailed = true })
    return { stop, pid: child.pid }
  }, waitReady: async () => {
    const deadline = Date.now() + 180000
    while (Date.now() < deadline) {
      if (launchFailed || child.exitCode !== null || child.signalCode !== null) throw new Error('qa_http_server_start_failed')
      try { if ((await http(`${url.origin}/api/health/live`)).ok) return } catch { /* Only wait for our compiler. */ }
      await new Promise(done => setTimeout(done, 500))
    }
    throw new Error('qa_http_server_start_timeout')
  } })
}
function cookieHeader(jar) { return [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; ') }
function captureCookies(response, jar) {
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';', 1)[0], at = pair.indexOf('='), name = pair.slice(0, at)
    if (/max-age=0/i.test(cookie)) jar.delete(name)
    else jar.set(name, decodeURIComponent(pair.slice(at + 1)))
  }
}
function verifyIdentity(actor, data) {
  if (data?.user?.id !== actor.authId || data.user.app_metadata?.app_role !== 'customer' ||
    data.user.app_metadata?.signup_source !== 'qa_pedir_http' || data.user.app_metadata?.qa_pedir_http_run !== actor.runId || data.user.email !== actor.email) fail()
}
export function retainVerifiedQaLogin(actor, session, identity, loggedInAtMs = Date.now()) {
  const jwt = claims(session?.access_token)
  if (jwt.iss !== `${QA_URL}/auth/v1` || jwt.sub !== actor.authId || jwt.role !== 'authenticated' || !UUID.test(jwt.session_id ?? '') ||
    jwt.app_metadata?.app_role !== 'customer' || !Number.isSafeInteger(loggedInAtMs) || loggedInAtMs < 0) fail()
  verifyIdentity(actor, identity)
  actor.jwtTiming = safeQaJwtTiming(jwt)
  actor.sessionId = jwt.session_id
  actor.loggedInAtMs = loggedInAtMs
  actor.logoutAccessToken = session.access_token
}
export function acceptCreatedQaActor(actor, data) {
  if (!UUID.test(actor.runId ?? '') || ![0, 1].some(index => actor.email === `pedir-http-${actor.runId}-${index}@lysto.invalid`) ||
    !UUID.test(data?.user?.id ?? '')) fail()
  const actual = { ...actor, authId: data.user.id }
  verifyIdentity(actual, data)
  actor.authId = actual.authId
}
export function assertUnavailableQaPreview(preview, baseline) {
  assertQaBaseline(baseline)
  if (preview.status !== 'needs_review' || preview.reason !== 'tariffs_unapproved' || preview.previewId || preview.jobId || preview.quote) fail()
}
async function executeQa(config) {
  const cwd = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  assertNoQaDotenv(readdirSync(cwd))
  if (process.platform !== 'win32') throw new Error('qa_http_isolated_windows_wrapper_required')
  cliHelp(['db', 'query']); cliHelp(['projects', 'api-keys'])
  const baseline = queryQa(qaSnapshotSql).snapshot; assertQaBaseline(baseline)
  const rawKeys = cli(['projects', 'api-keys', '--project-ref', QA_REF, '--reveal', '--output', 'json'])
  if (!Array.isArray(rawKeys)) fail()
  const keys = assertQaKeys({ anon: rawKeys.find(key => key.name === 'anon')?.api_key, service: rawKeys.find(key => key.name === 'service_role')?.api_key })
  const http = boundedQaFetch({ origin: config.origin })
  const { createClient } = await import('@supabase/supabase-js')
  const { createServerClient } = await import('@supabase/ssr')
  const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  const admin = createClient(QA_URL, keys.service, { auth: authOptions, global: { fetch: http } })
  const policy = await admin.rpc('get_registration_policy')
  if (policy.error || !policy.data?.terms_version || !policy.data?.privacy_version) throw new Error('qa_http_existing_registration_policy_required')
  const state = { projectRef: QA_REF, runId: randomUUID(), phase: 'preflight', baseline, actors: [], rateKeys: [], uncertain: [], checks: [] }
  const folder = resolve(cwd, 'output', 'customer-request-http-qa'); mkdirSync(folder, { recursive: true })
  const manifestPath = join(folder, `${state.runId}.json`)
  const record = phase => { state.phase = phase; writeFileSync(manifestPath, JSON.stringify(publicManifest(state), null, 2) + '\n') }
  const fileHash = name => { try { return createHash('sha256').update(readFileSync(join(cwd, name))).digest('hex') } catch { return null } }
  const sourceHashes = Object.fromEntries(['next-env.d.ts', 'tsconfig.json'].map(name => [name, fileHash(name)]))
  const syntheticIp = `qa-pedir-${state.runId}`
  let passed = false, cleanupFailed = false
  record('preflight')
  try {
    for (let index = 0; index < 2; index++) {
      const actor = { runId: state.runId, email: `pedir-http-${state.runId}-${index}@lysto.invalid`, password: `Qa-${randomBytes(32).toString('base64url')}-aA1!`, jar: new Map() }
      state.actors.push(actor); state.uncertain.push('auth-create'); record('preflight')
      const created = await admin.auth.admin.createUser({ email: actor.email, password: actor.password, email_confirm: true,
        app_metadata: { app_role: 'customer', signup_source: 'qa_pedir_http', qa_pedir_http_run: state.runId } })
      if (created.error || !created.data.user) throw new Error('qa_http_auth_creation_failed')
      acceptCreatedQaActor(actor, created.data); state.uncertain.pop(); record('preflight')
      actor.client = createServerClient(QA_URL, keys.anon, { auth: { autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: http },
        cookies: { getAll: () => [...actor.jar].map(([name, value]) => ({ name, value })), setAll: cookies => { for (const cookie of cookies) actor.jar.set(cookie.name, cookie.value) } } })
      state.uncertain.push('auth-signin'); record('preflight')
      const login = await actor.client.auth.signInWithPassword({ email: actor.email, password: actor.password })
      if (login.error || !login.data.session || !actor.jar.size) throw new Error('qa_http_auth_signin_failed')
      const verified = await actor.client.auth.getUser(); if (verified.error) fail()
      retainVerifiedQaLogin(actor, login.data.session, verified.data); state.uncertain.pop(); record('preflight')
      state.uncertain.push('registration'); record('preflight')
      const registration = await actor.client.rpc('complete_customer_registration', { p_first_name: 'QA', p_last_name: 'HTTP', p_phone: `+54110000000${index}`,
        p_terms_version: policy.data.terms_version, p_privacy_version: policy.data.privacy_version, p_accepted: true })
      if (registration.error || registration.data?.status !== 'ready' || !UUID.test(registration.data.profile_id ?? '') || !UUID.test(registration.data.customer_id ?? '')) throw new Error('qa_http_registration_failed')
      actor.profileId = registration.data.profile_id; actor.customerId = registration.data.customer_id; state.uncertain.pop(); record('fixtures-created')
      const session = await actor.client.rpc('get_session_context')
      if (session.error || session.data?.profile_id !== actor.profileId || session.data.customer_id !== actor.customerId || session.data.session_id !== actor.sessionId || session.data.session_active !== true || session.data.role !== 'customer') fail()
      state.rateKeys.push(`private_mutation:${createHmac('sha256', RATE_SECRET).update(`${actor.profileId}:${syntheticIp}`).digest('hex')}`)
      record('fixtures-created')
    }
    record('server-starting')
    const startingAtMs = Date.now()
    await startApp(cwd, createQaChildEnvironment({ origin: config.origin, keys }), http, owned => { state.app = owned })
    state.nextReadyDurationMs = Date.now() - startingAtMs
    record('http-checks')
    const [a, b] = state.actors
    const check = async (name, actor, path, method = 'GET', body, expected = 200, overrides = {}) => {
      const requestAtMs = Date.now()
      const headers = { Cookie: cookieHeader(actor.jar), 'X-Lysto-Customer-Id': actor.customerId, 'X-Forwarded-For': syntheticIp,
        ...(method === 'GET' ? {} : { Origin: config.origin, 'Content-Type': 'application/json' }), ...overrides }
      for (const [key, value] of Object.entries(headers)) if (value === null) delete headers[key]
      if (method !== 'GET') { state.uncertain.push('app-mutation'); record('http-checks') }
      let response, result
      const evidence = (kind, response) => {
        state.failure = safeQaHttpFailure({ check: name, kind, apiErrorCode: result?.code,
          loginToRequestDurationMs: requestAtMs - actor.loggedInAtMs, jwtRemainingSeconds: actor.jwtTiming.exp - Math.floor(requestAtMs / 1000),
          ...(response ? { status: response.status, cacheProtected: !!response.headers.get('cache-control')?.includes('no-store') } : {}) })
        record('http-checks')
        throw new Error('qa_http_response_assertion_failed')
      }
      try { response = await http(`${config.origin}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }) }
      catch { evidence('transport') }
      captureCookies(response, actor.jar)
      try { result = await response.json() } catch { evidence('json', response) }
      if (response.status !== expected) evidence('status', response)
      if (!response.headers.get('cache-control')?.includes('no-store')) evidence('cache', response)
      if (method !== 'GET') state.uncertain.pop()
      state.checks.push(name); record('http-checks'); return result
    }
    for (const actor of [a, b]) {
      const empty = await check('empty-owned-homes', actor, '/api/customer/homes')
      if (JSON.stringify(empty) !== JSON.stringify({ homes: [], addresses: [], equipment: [] })) fail()
    }
    await check('missing-actor-rejected', a, '/api/customer/homes', 'GET', undefined, 403, { 'X-Lysto-Customer-Id': null })
    await check('wrong-actor-rejected', a, '/api/customer/homes', 'GET', undefined, 403, { 'X-Lysto-Customer-Id': b.customerId })
    await check('missing-session-rejected', a, '/api/customer/homes', 'GET', undefined, 401, { Cookie: null })
    const floorId = randomUUID(), roomId = randomUUID()
    const create = { name: 'QA Casa', kind: 'house', building: null, features: { balcony: false, terrace: false, windows: 'small' }, addressId: null,
      newAddress: { label: 'QA Casa', street: 'QA Synthetic', number: '1', city: 'CABA', province: 'CABA', propertyType: 'house', access: {}, isDefault: false },
      floors: [{ id: floorId, name: 'Planta principal', order: 0, rooms: [] }], placements: [], idempotencyKey: randomUUID() }
    await check('missing-origin-rejected', a, '/api/customer/homes', 'POST', create, 403, { Origin: null })
    await check('cross-origin-rejected', a, '/api/customer/homes', 'POST', create, 403, { Origin: 'https://not-authorized.invalid' })
    const created = await check('home-created', a, '/api/customer/homes', 'POST', create, 201)
    const replay = await check('home-idempotent-replay', a, '/api/customer/homes', 'POST', create, 201)
    if (!UUID.test(created.home?.id ?? '') || replay.home?.id !== created.home.id || !UUID.test(created.address?.id ?? '')) fail()
    let home = created.home
    const saveInput = home => { const { version, addressIds, ...fields } = home; void addressIds; return { ...fields, expectedVersion: version } }
    const withRoom = { ...saveInput(home), floors: [{ ...home.floors[0], rooms: [{ id: roomId, name: 'Living', kind: 'living', variant: 'family', x: 0, z: 0, width: 4, depth: 4, rotation: 0, windows: 'small' }] }] }
    home = (await check('room-saved', a, '/api/customer/homes', 'PUT', withRoom)).home
    await check('stale-home-version-rejected', a, '/api/customer/homes', 'PUT', withRoom, 409)
    const airInput = { homeId: home.id, expectedVersion: home.version, idempotencyKey: randomUUID(),
      equipment: { nickname: 'QA Aire', equipmentType: 'inverter', frigorias: 3000 }, placement: { roomId, wall: 'north', offset: .5, height: 2 } }
    const air = await check('air-registered-and-placed', a, '/api/customer/homes/equipment', 'POST', airInput, 201)
    const airReplay = await check('air-idempotent-replay', a, '/api/customer/homes/equipment', 'POST', airInput, 201)
    if (!UUID.test(air.equipment?.id ?? '') || airReplay.equipment?.id !== air.equipment.id) fail()
    const snapshot = await check('canonical-owned-inventory', a, '/api/customer/homes')
    if (snapshot.homes?.length !== 1 || snapshot.addresses?.length !== 1 || snapshot.equipment?.length !== 1) fail()
    home = snapshot.homes[0]
    const foreign = await check('other-customer-cannot-read-home', b, '/api/customer/homes')
    if (foreign.homes?.length || foreign.addresses?.length || foreign.equipment?.length) fail()
    await check('other-customer-cannot-save-home', b, '/api/customer/homes', 'PUT', saveInput(home), 404)
    const preferredDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
    const preview = await check('unapproved-initial-scope-fails-closed', a, '/api/customer/requests/preview', 'POST', {
      equipmentId: air.equipment.id, expectedEquipmentVersion: snapshot.equipment[0].version, addressId: home.addressId, homeId: home.id,
      expectedHomeVersion: home.version, floorId, roomId, issue: 'pierde_agua', timeSince: 'days', description: 'QA HTTP smoke', answers: {},
      preferredDate, timeWindow: '10:00 – 12:00', urgency: 'flexible', uploadIntentIds: [] })
    assertUnavailableQaPreview(preview, baseline)
    passed = true
  } catch { /* Keep credentials/provider bodies out of every diagnostic; manifest records phase only. */ }
  finally {
    record('stopping-server')
    cleanupFailed = !await quiesceBeforeQaCleanup(state)
    // Do not remove accounts while an owned app can still mutate them.
    if (!cleanupFailed) {
      record('cleanup')
      try {
        await verifyQaSessionRevocation(state.actors, actors => {
          const ids = actors.map(actor => actor.authId)
          if (ids.some(id => !UUID.test(id ?? ''))) fail()
          return queryQa(`select count(*)::integer as count from auth.sessions where user_id = any(array[${ids.map(id => `'${id}'`).join(',')}]::uuid[]);`).count
        }, actor => admin.auth.admin.signOut(actor.logoutAccessToken, 'global'), proof => { state.sessionRevocation = proof; record('cleanup') })
      } catch { cleanupFailed = true; state.uncertain.push('session-revocation') }
    }
    if (!cleanupFailed) {
      cleanupFailed = !await cleanupOwnedQaFixtures(state, {
        deleteActor: async actor => {
          const inspectRemaining = owned => queryQa(ownedActorAbsenceSql(owned)).remaining
          const current = await admin.auth.admin.getUserById(actor.authId)
          if (current.error?.status === 404 || current.error === null && current.data?.user?.id === undefined) {
            assertQaActorAbsent(await inspectRemaining(actor)); return
          }
          if (current.error) throw new Error('qa_http_identity_lookup_failed')
          verifyIdentity(actor, current.data)
          const removed = await admin.auth.admin.deleteUser(actor.authId)
          await verifyQaActorDeleted(actor, removed, inspectRemaining)
        }, deleteRates: rateKeys => queryQa(ownedRateCleanupSql(rateKeys))
      })
    }
    if (!cleanupFailed) {
      try { state.after = queryQa(qaSnapshotSql).snapshot; assertQaRestored(baseline, state.after, state.uncertain) }
      catch { cleanupFailed = true }
    }
    state.sourceFilesChanged = Object.keys(sourceHashes).filter(name => sourceHashes[name] !== fileHash(name))
    record(cleanupFailed || state.uncertain.length ? 'cleanup-required' : 'cleaned')
  }
  if (!passed || cleanupFailed || state.uncertain.length) throw new Error('qa_http_smoke_failed_inspect_nonsecret_manifest')
  return { mode: 'execute', projectRef: QA_REF, scope: 'partial real Auth/HTTP only', passed: state.checks.length,
    cleanup: 'verified', manifestPath, sourceFilesChanged: state.sourceFilesChanged }
}
export async function main(args = process.argv.slice(2)) {
  const config = parseQaArguments(args)
  if (config.mode === 'dry-run') return { mode: 'dry-run', projectRef: QA_REF, scope: 'partial real Auth/HTTP only; no payment/provider/browser/PG acceptance',
    phases: ['Review source and authorize explicit QA execution', 'Read-only exact79-migration/empty-state/policy/permissions baseline via isolated CLI',
      'CLI QA keys held only in RAM; validate JWT refs/roles/expiry', 'Create two .invalid synthetic Auth customers; real sign-in/SSR cookies and existing registration RPC',
      'Owned loopback Next app with allowlisted QA env; no dotenv, SMTP, provider or worker credentials', 'Bounded home/room/air and negative-guard HTTP smoke; unavailable Pedir preview only',
      'Stop own Next PID tree, sign out/delete only verified owned Auth IDs, delete only two exact HMAC rate keys', 'Compare complete app-table counts and policy/permission/migration fingerprints; uncertainty requires manual manifest reconciliation'],
    executeArguments: ['--execute', '--qa-ref', QA_REF, '--origin', 'http://127.0.0.1:<fresh-explicit-port>'] }
  return executeQa(config)
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().then(result => console.log(JSON.stringify(result, null, 2))).catch(() => { console.error('QA HTTP smoke failed; inspect the non-secret run manifest. No credentials or provider responses are logged.'); process.exitCode = 1 })
}
