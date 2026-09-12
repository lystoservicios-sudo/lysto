import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'
import { boundedFixtureOperation, runFixtureCleanup } from './fixture-lifecycle.mjs'
import { enrollFixtureMfa } from './mfa'

export const accountNames = ['customerA', 'customerB', 'professionalApproved', 'professionalSuspended', 'operations', 'finance', 'quality', 'owner'] as const
export type AccountName = typeof accountNames[number]
export type FixtureAccount = { authId: string; profileId: string; entityId: string; email: string; password: string; accessToken: string; refreshToken: string; client: SupabaseClient }

export function createFixtureAccounts({ mfa = true }: { mfa?: boolean } = {}) {
  const env = process.env
  const target = assertTestEnvironment(env, readTestIdentity(env))
  const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  const setupController = new AbortController()
  const fetchFor = (setup: boolean): typeof fetch => (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.origin !== target.apiUrl) throw new Error('Fixture HTTP requests must stay inside the disposable Supabase API')
    const originalSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
    const signals = [originalSignal, ...(setup ? [setupController.signal] : [])].filter((signal): signal is AbortSignal => Boolean(signal))
    return boundedFixtureOperation('fixture HTTP request', async signal => {
      const response = await fetch(input, { ...init, redirect: 'error', signal })
      // Keep the deadline until the body finishes, not merely until headers arrive.
      const body = await response.arrayBuffer()
      return new Response([101, 204, 205, 304].includes(response.status) ? null : body, {
        status: response.status, statusText: response.statusText, headers: response.headers
      })
    }, {
      timeoutMs: setup ? 10_000 : 4_000,
      signal: signals.length ? AbortSignal.any(signals) : undefined
    })
  }
  const options = { auth: authOptions, global: { fetch: fetchFor(true) } }
  const admin = createClient(target.apiUrl, env.LYSTO_TEST_SERVICE_ROLE_KEY!, options)
  const cleanupAdmin = createClient(target.apiUrl, env.LYSTO_TEST_SERVICE_ROLE_KEY!, { auth: authOptions, global: { fetch: fetchFor(false) } })
  const database = new Client({ connectionString: target.databaseUrl, connectionTimeoutMillis: 5_000, query_timeout: 10_000, statement_timeout: 10_000, lock_timeout: 5_000 })
  // A transport failure is reported by the bounded operation, not an unhandled
  // emitter error while a cancelled transaction is being disconnected.
  database.on('error', () => {})
  const created: string[] = []
  const uncertainCreations = new Set<string>()
  const accounts = {} as Record<AccountName, FixtureAccount>
  const runId = randomUUID()
  const manifestPath = resolve('output', 'integration', `fixtures-${runId}.json`)
  mkdirSync(resolve('output', 'integration'), { recursive: true })
  const record = (status: string, failures: string[] = []) => writeFileSync(manifestPath, JSON.stringify({ runId, projectId: target.projectId, status, authIds: created, uncertainAuthIds: [...uncertainCreations], failures, updatedAt: new Date().toISOString() }, null, 2) + '\n')
  record('creating')
  const setupTimer = setTimeout(() => setupController.abort(), 150_000)
  let cleanupPending: Promise<void> | undefined
  const cleanup = () => {
    if (cleanupPending) return cleanupPending
    clearTimeout(setupTimer)
    setupController.abort()
    cleanupPending = (async () => {
      // End first: rolls back any cancelled transaction before Auth cascades.
      const steps: Array<{ label: string; run: () => Promise<unknown> }> = [{ label: 'close database', run: () => database.end() }]
      steps.push({ label: 'remove scoped operational records', run: async () => {
        const cleanupDatabase = new Client({ connectionString: target.databaseUrl, connectionTimeoutMillis: 4_000, query_timeout: 4_000, statement_timeout: 4_000, lock_timeout: 2_000 })
        cleanupDatabase.on('error', () => {})
        try {
          await cleanupDatabase.connect()
          const profiles = Object.values(accounts).map(account => account.profileId)
          const entities = Object.values(accounts).map(account => account.entityId)
          await cleanupDatabase.query('delete from private.outbox_events where recipient_profile_id=any($1::uuid[]) or aggregate_id=any($2::uuid[])', [profiles, entities])
          await cleanupDatabase.query('delete from public.admin_audit_logs where actor_profile_id=any($1::uuid[]) or entity_id=any($2::uuid[])', [profiles, entities])
        } finally { await cleanupDatabase.end() }
      } })
      for (const authId of [...created].reverse()) {
        const account = Object.values(accounts).find(a => a.authId === authId)
        if (account) steps.push({ label: `signout ${authId}`, run: async () => {
          const { error } = await cleanupAdmin.auth.admin.signOut(account.accessToken, 'global')
          if (error) throw new Error('fixture signout failed')
        } })
        steps.push({ label: `delete ${authId}`, run: async () => {
          const { error } = await cleanupAdmin.auth.admin.deleteUser(authId)
          if (error && error.status !== 404 && error.code !== 'user_not_found') throw new Error('fixture delete failed')
        } })
      }
      const failures = await runFixtureCleanup(steps)
      // Aborting HTTP cannot prove the server did not commit later. Keep the
      // pre-registered ID recoverable and never certify that case as cleaned.
      if (uncertainCreations.size) failures.push('uncertain Auth creation; reconcile exact manifest IDs')
      record(failures.length ? 'cleanup_failed' : 'cleaned', failures)
      if (failures.length) throw new Error(`Fixture cleanup failed (${failures.join(', ')})`)
    })()
    return cleanupPending
  }
  const step = <T>(label: string, operation: () => Promise<T>) => boundedFixtureOperation(label, operation, { signal: setupController.signal })
  const query = (sql: string, values?: unknown[]) => step('fixture database query', () => database.query(sql, values))
  const pending = (async () => { try {
    await step('fixture database connection', () => database.connect())
    for (const name of accountNames) {
      const role = name.startsWith('customer') ? 'customer' : name.startsWith('professional') ? 'professional' : 'admin'
      const email = `${name.toLowerCase()}.${runId}@lysto.test`
      const password = `Test-${randomUUID()}-aA1!`
      const authId = randomUUID()
      created.push(authId)
      uncertainCreations.add(authId)
      record('creating')
      const { data, error } = await step('fixture Auth creation', () => admin.auth.admin.createUser({ id: authId, email, password, email_confirm: true, app_metadata: { app_role: role }, user_metadata: { fixture_run: runId } }))
      if (error || !data.user) throw new Error(`Unable to create synthetic Auth account ${name} (${error?.code ?? 'no-user'}, HTTP ${error?.status ?? 'unknown'})`)
      if (data.user.id !== authId) {
        created.push(data.user.id)
        record('creating')
        throw new Error('Auth did not preserve the pre-registered synthetic user ID')
      }
      uncertainCreations.delete(authId)
      record('creating')
      const profileId = randomUUID(), entityId = randomUUID()
      await query('begin')
      try {
        await query('insert into public.profiles (id,auth_user_id,role,first_name,last_name,email) values ($1,$2,$3,$4,$5,$6)', [profileId, data.user.id, role, name, 'Synthetic', email])
        if (role === 'customer') {
          await query('insert into public.customer_profiles (id,profile_id) values ($1,$2)', [entityId, profileId])
          await query('insert into public.customer_addresses (customer_id,street,number,city,province) values ($1,$2,$3,$4,$5)', [entityId, `Synthetic ${name}`, '1', 'CABA', 'CABA'])
        } else if (role === 'professional') {
          await query('insert into public.professional_profiles (id,profile_id,status) values ($1,$2,$3)', [entityId, profileId, name === 'professionalApproved' ? 'approved' : 'suspended'])
        } else {
          await query('insert into public.admin_profiles (id,profile_id,can_manage_payments,can_manage_professionals) values ($1,$2,$3,$4)', [entityId, profileId, name === 'finance' || name === 'owner', name === 'operations' || name === 'owner'])
          await query('insert into private.admin_profile_permissions (admin_profile_id,permission) values ($1,$2)', [entityId, name])
        }
        await query('commit')
      } catch (error) {
        if (!setupController.signal.aborted) await query('rollback')
        throw error
      }
      const client = createClient(target.apiUrl, env.LYSTO_TEST_ANON_KEY!, options)
      const { data: login, error: loginError } = await step('fixture Auth sign in', () => client.auth.signInWithPassword({ email, password }))
      if (loginError || !login.session) throw new Error(`Unable to sign in synthetic account ${name}`)
      accounts[name] = { authId: data.user.id, profileId, entityId, email, password, accessToken: login.session.access_token, refreshToken: login.session.refresh_token, client }
      if (mfa && (role === 'admin' || name === 'professionalApproved')) {
        await step('fixture MFA verification', () => enrollFixtureMfa(accounts[name]))
      }
    }
    clearTimeout(setupTimer)
    record('ready')
    return { runId, accounts, cleanup }
  } catch (error) {
    try { await cleanup() }
    catch { throw new Error('Fixture setup failed and cleanup requires reconciliation; inspect the non-secret run manifest') }
    throw error
  } })()
  return Object.assign(pending, { cleanup, runId })
}
