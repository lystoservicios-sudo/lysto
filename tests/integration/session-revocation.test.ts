import { randomUUID } from 'node:crypto'
import { chromium } from '@playwright/test'
import { Client } from 'pg'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createFixtureAccounts, type AccountName } from './fixtures'
import { fixtureCookieHeader, startTestApp } from './http'
import { enrollFixtureMfa, fixtureTotp } from './mfa'
import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'

describe('effective session revocation and administrative MFA', () => {
  let pending: ReturnType<typeof createFixtureAccounts> | undefined
  let fixture: Awaited<ReturnType<typeof createFixtureAccounts>>
  let app: Awaited<ReturnType<typeof startTestApp>> | undefined
  let pendingApp: ReturnType<typeof startTestApp> | undefined
  let database: Client | undefined, admin: SupabaseClient, apiUrl: string
  let financeFactorId: string | undefined
  const requestId = randomUUID(),
    jobId = randomUUID(),
    paymentId = randomUUID(),
    nextRequestId = randomUUID(),
    nextJobId = randomUUID()
  beforeAll(async () => {
    pending = createFixtureAccounts({ mfa: false })
    fixture = await pending
    const target = assertTestEnvironment(process.env, readTestIdentity(process.env))
    apiUrl = target.apiUrl
    admin = createClient(apiUrl, process.env.LYSTO_TEST_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) })
      }
    })
    database = new Client({
      connectionString: target.databaseUrl,
      connectionTimeoutMillis: 5000,
      query_timeout: 10000
    })
    await database.connect()
    await database.query(
      "insert into public.service_requests(id,customer_id,category_id,issue_type_id,status) select $1,$2,c.id,i.id,'pending_assignment' from public.service_categories c join public.service_issue_types i on i.category_id=c.id where c.slug='aire_acondicionado' and i.slug='mantenimiento'",
      [requestId, fixture.accounts.customerA.entityId]
    )
    await database.query(
      "insert into public.jobs(id,request_id,customer_id,professional_id,status) values($1,$2,$3,$4,'confirmed')",
      [
        jobId,
        requestId,
        fixture.accounts.customerA.entityId,
        fixture.accounts.professionalApproved.entityId
      ]
    )
    await database.query(
      'insert into public.payments(id,job_id,request_id,customer_id,professional_id,amount,marketplace_fee,professional_amount) values($1,$2,$3,$4,$5,1000,180,820)',
      [
        paymentId,
        jobId,
        requestId,
        fixture.accounts.customerA.entityId,
        fixture.accounts.professionalApproved.entityId
      ]
    )
    pendingApp = startTestApp()
    app = await pendingApp
  }, 300000)
  afterAll(async () => {
    try {
      await (app ?? (await pendingApp?.catch(() => undefined)))?.stop()
    } finally {
      try {
        if (database && fixture) {
          const profiles = Object.values(fixture.accounts).map((a) => a.profileId),
            entities = Object.values(fixture.accounts).map((a) => a.entityId)
          await database.query(
            'delete from private.outbox_events where aggregate_id=any($1::uuid[]) or recipient_profile_id=any($2::uuid[])',
            [entities, profiles]
          )
          await database.query(
            'delete from public.admin_audit_logs where entity_id=any($1::uuid[]) or actor_profile_id=any($2::uuid[])',
            [entities, profiles]
          )
          await database.query(
            'delete from private.upload_intents where owner_profile_id=any($1::uuid[])',
            [profiles]
          )
          await database.query(
            'delete from private.request_upload_drafts where owner_profile_id=any($1::uuid[])',
            [profiles]
          )
          await database.query('delete from public.payments where id=$1', [paymentId])
          await database.query('delete from public.service_requests where id=any($1::uuid[])', [
            [requestId, nextRequestId]
          ])
          await database.query(
            'delete from public.mp_split_connected_accounts where seller_id=$1',
            [fixture.accounts.professionalApproved.entityId]
          )
        }
      } finally {
        try {
          await database?.end()
        } finally {
          await pending?.cleanup()
        }
      }
    }
  }, 180000)
  async function raw(path: string, token: string, body?: unknown) {
    return fetch(new URL('/rest/v1/' + path, apiUrl), {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        apikey: process.env.LYSTO_TEST_ANON_KEY!,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    })
  }
  async function http(path: string, account: AccountName, method = 'GET', cookie?: string) {
    return fetch(new URL(path, app!.baseURL), {
      method,
      redirect: 'manual',
      headers: {
        Origin: app!.baseURL,
        Cookie: cookie ?? (await fixtureCookieHeader(fixture.accounts[account])),
        'Content-Type': 'application/json'
      },
      body: method === 'POST' ? '{}' : undefined,
      signal: AbortSignal.timeout(90000)
    })
  }
  async function signInAgain(account: AccountName) {
    const a = fixture.accounts[account],
      result = await a.client.auth.signInWithPassword({ email: a.email, password: a.password })
    if (result.error || !result.data.session) throw Error('Could not restore disposable session')
    a.accessToken = result.data.session.access_token
    a.refreshToken = result.data.session.refresh_token
  }
  it('requires administrative MFA in both the API and direct financial reads', async () => {
    const response = await http('/api/pricing/policy', 'finance', 'PUT')
    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('mfa_required')
    expect(
      await (
        await raw(`payments?select=id&id=eq.${paymentId}`, fixture.accounts.finance.accessToken)
      ).json()
    ).toEqual([])
    expect(
      await (
        await raw(
          `profiles?select=id&id=eq.${fixture.accounts.finance.profileId}`,
          fixture.accounts.finance.accessToken
        )
      ).json()
    ).toEqual([])
  })
  it('accepts an actual verified TOTP session without claiming a deferred mutation succeeded', async () => {
    const enrolled = await enrollFixtureMfa(fixture.accounts.finance)
    financeFactorId = enrolled.factorId
    const claims = JSON.parse(
      Buffer.from(fixture.accounts.finance.accessToken.split('.')[1], 'base64url').toString()
    )
    expect(claims.aal).toBe('aal2')
    expect((await http('/api/pricing/policy', 'finance', 'PUT')).status).toBe(400)
    expect(
      await (
        await raw(`payments?select=id&id=eq.${paymentId}`, fixture.accounts.finance.accessToken)
      ).json()
    ).toEqual([{ id: paymentId }])
  })
  it('renders security without enrolling on GET and redirects aal1 administration there', async () => {
    const a = fixture.accounts.operations
    const before = await a.client.auth.mfa.listFactors()
    const response = await http('/seguridad?next=https://untrusted.invalid', 'operations')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(await response.text()).toContain('Configurar autenticador')
    expect((await a.client.auth.mfa.listFactors()).data?.all).toEqual(before.data?.all)
    const page = await http('/admin/dashboard', 'operations')
    expect([303, 307]).toContain(page.status)
    expect(page.headers.get('location')).toBe('/seguridad')
    const anonymous = await fetch(new URL('/seguridad', app!.baseURL), { redirect: 'manual' })
    expect([303, 307]).toContain(anonymous.status)
    expect(anonymous.headers.get('location')).toBe('/login')
  })
  it('enrolls and verifies a real authenticator through the browser without persisting setup material', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const context = await browser.newContext()
      const header = await fixtureCookieHeader(fixture.accounts.quality)
      await context.addCookies(
        header.split('; ').map((cookie) => {
          const separator = cookie.indexOf('=')
          return {
            name: cookie.slice(0, separator),
            value: cookie.slice(separator + 1),
            url: app!.baseURL,
            sameSite: 'Lax' as const
          }
        })
      )
      const page = await context.newPage()
      await page.goto(new URL('/seguridad', app!.baseURL).toString())
      await page.getByRole('button', { name: 'Configurar autenticador' }).click()
      const key = page.getByLabel('Clave de configuración')
      await key.waitFor({ state: 'visible' })
      await page.waitForFunction(() => {
        const image = document.querySelector<HTMLImageElement>(
          'img[alt="QR para configurar tu autenticador"]'
        )
        return image?.complete && image.naturalWidth > 0
      })
      const secret = await key.inputValue()
      await page.getByLabel('Código del autenticador').fill(fixtureTotp(secret))
      await page.getByRole('button', { name: 'Verificar y continuar' }).click()
      await page.waitForURL(new URL('/admin/dashboard', app!.baseURL).toString())
      expect(await page.getByLabel('Clave de configuración').count()).toBe(0)
      expect(
        await page.evaluate(() =>
          Object.keys(localStorage).filter((key) => /secret|totp|setup/i.test(key))
        )
      ).toEqual([])
      await page.reload()
      expect(new URL(page.url()).pathname).toBe('/admin/dashboard')
      await context.close()
    } catch {
      // Playwright action logs can include a filled OTP. Never persist them.
      throw new Error('Browser MFA flow failed; session and setup material were not recorded')
    } finally {
      await browser.close()
    }
  }, 90000)
  it('suspends with an audited reason and alerts operations once while retaining financial history', async () => {
    const operations = fixture.accounts.operations,
      professional = fixture.accounts.professionalApproved
    await enrollFixtureMfa(operations)
    const token = professional.accessToken
    const parameters = {
      p_professional_id: professional.entityId,
      p_reason: 'Revisión operativa de prueba'
    }
    await database!.query(
      "insert into public.mp_split_connected_accounts(seller_id,mercado_pago_user_id,encrypted_access_token,access_token_expires_at,created_at,updated_at) values($1,$2,'fixture-not-a-token',now()+interval '1 hour',now(),now())",
      [professional.entityId, fixture.runId]
    )
    expect(
      (await raw('rpc/suspend_professional', fixture.accounts.customerA.accessToken, parameters))
        .status
    ).toBe(403)
    expect(
      (await raw('rpc/suspend_professional', fixture.accounts.finance.accessToken, parameters))
        .status
    ).toBe(403)
    expect(
      (
        await raw('rpc/suspend_professional', operations.accessToken, {
          ...parameters,
          p_reason: ' '
        })
      ).status
    ).toBe(400)
    const suspended = await raw('rpc/suspend_professional', operations.accessToken, parameters)
    expect(suspended.status).toBe(200)
    expect(await suspended.json()).toMatchObject({
      status: 'suspended',
      active_jobs: 1,
      idempotent: false
    })
    const repeated = await raw('rpc/suspend_professional', operations.accessToken, parameters)
    expect(await repeated.json()).toMatchObject({ idempotent: true })
    expect(await (await raw(`jobs?select=id&id=eq.${jobId}`, token)).json()).toEqual([])
    expect((await http('/api/pricing/policy', 'professionalApproved')).status).toBe(403)
    const alerts = await database!.query(
      "select recipient_profile_id,payload from private.outbox_events where event_type='professional.suspended' and aggregate_id=$1",
      [professional.entityId]
    )
    expect(alerts.rows).toHaveLength(2)
    expect(alerts.rows.map((row) => row.recipient_profile_id).sort()).toEqual(
      [operations.profileId, fixture.accounts.owner.profileId].sort()
    )
    expect(alerts.rows[0].payload.active_job_ids).toEqual([jobId])
    const audit = await database!.query(
      "select actor_profile_id,metadata from public.admin_audit_logs where action='professional.suspended' and entity_id=$1",
      [professional.entityId]
    )
    expect(audit.rows).toHaveLength(1)
    expect(audit.rows[0].actor_profile_id).toBe(operations.profileId)
    expect(audit.rows[0].metadata.reason).toBe(parameters.p_reason)
    expect(
      (
        await database!.query(
          'select enabled from public.mp_split_connected_accounts where seller_id=$1',
          [professional.entityId]
        )
      ).rows
    ).toEqual([{ enabled: true }])
    expect(
      (
        await database!.query('select count(*)::int as n from public.payments where id=$1', [
          paymentId
        ])
      ).rows[0].n
    ).toBe(1)
    expect(
      await (
        await raw(`payments?select=id&id=eq.${paymentId}`, fixture.accounts.finance.accessToken)
      ).json()
    ).toEqual([{ id: paymentId }])
    await database!.query(
      "insert into public.service_requests(id,customer_id,category_id,issue_type_id,status) select $1,customer_id,category_id,issue_type_id,'pending_assignment' from public.service_requests where id=$2",
      [nextRequestId, requestId]
    )
    await database!.query(
      "insert into public.jobs(id,request_id,customer_id,status) values($1,$2,$3,'pending_assignment')",
      [nextJobId, nextRequestId, fixture.accounts.customerA.entityId]
    )
    const assignment = await raw('rpc/assign_professional_to_job', operations.accessToken, {
      p_job_id: nextJobId,
      p_request_id: nextRequestId,
      p_professional_id: professional.entityId,
      p_admin_profile_id: operations.entityId
    })
    expect(assignment.status).toBe(400)
    expect((await assignment.json()).message).toBe('Professional is not approved')
    const endpoint = await fetch(new URL('/api/admin/professionals/suspend', app!.baseURL), {
      method: 'POST',
      headers: {
        Origin: app!.baseURL,
        Cookie: await fixtureCookieHeader(operations),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ professionalId: professional.entityId, reason: parameters.p_reason }),
      signal: AbortSignal.timeout(90000)
    })
    expect(endpoint.status).toBe(200)
    expect(await endpoint.json()).toMatchObject({ idempotent: true })
  })
  it('removes existing financial authority immediately when the permission is withdrawn', async () => {
    const token = fixture.accounts.finance.accessToken
    await database!.query(
      "delete from private.admin_profile_permissions where admin_profile_id=$1 and permission='finance'",
      [fixture.accounts.finance.entityId]
    )
    try {
      expect(await (await raw(`payments?select=id&id=eq.${paymentId}`, token)).json()).toEqual([])
      expect((await http('/api/pricing/policy', 'finance', 'PUT')).status).toBe(403)
    } finally {
      await database!.query(
        "insert into private.admin_profile_permissions(admin_profile_id,permission) values($1,'finance')",
        [fixture.accounts.finance.entityId]
      )
    }
  })
  it('rejects a valid old JWT after the trusted role is removed', async () => {
    const a = fixture.accounts.finance,
      token = a.accessToken
    const changed = await admin.auth.admin.updateUserById(a.authId, {
      app_metadata: { app_role: null }
    })
    expect(changed.error).toBeNull()
    try {
      expect(await (await raw('rpc/get_session_context', token, {})).json()).toBeNull()
      expect(await (await raw(`payments?select=id&id=eq.${paymentId}`, token)).json()).toEqual([])
    } finally {
      await admin.auth.admin.updateUserById(a.authId, { app_metadata: { app_role: 'admin' } })
    }
  })
  it('blocks a logged-out customer in another tab while the captured JWT is still unexpired', async () => {
    const a = fixture.accounts.customerA,
      token = a.accessToken,
      cookie = await fixtureCookieHeader(a)
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    expect(claims.exp).toBeGreaterThan(Date.now() / 1000)
    expect((await http('/auth/logout', 'customerA', 'POST', cookie)).status).toBe(303)
    try {
      expect(await (await raw('rpc/get_session_context', token, {})).json()).toBeNull()
      expect(
        await (await raw(`service_requests?select=id&id=eq.${requestId}`, token)).json()
      ).toEqual([])
      expect(await (await raw(`profiles?select=id&id=eq.${a.profileId}`, token)).json()).toEqual([])
      expect([401, 403]).toContain(
        (await http('/api/pricing/policy', 'customerA', 'GET', cookie)).status
      )
    } finally {
      await signInAgain('customerA')
    }
  })
  it('rejects a revoked customer token at the direct upload mutation boundary', async () => {
    const a = fixture.accounts.customerA,
      token = a.accessToken
    expect((await a.client.auth.signOut()).error).toBeNull()
    try {
      const response = await raw('rpc/create_upload_intent', token, {
        p_kind: 'request-photo',
        p_mime_type: 'image/png',
        p_size_bytes: 20,
        p_sha256: 'a'.repeat(64),
        p_entity_id: requestId,
        p_draft_id: null,
        p_phase: null,
        p_document_type: null
      })
      expect([401, 403]).toContain(response.status)
    } finally {
      await signInAgain('customerA')
    }
  })
  it('blocks banned users at the database boundary as well as the HTTP session boundary', async () => {
    const a = fixture.accounts.customerB,
      token = a.accessToken
    expect(
      (await admin.auth.admin.updateUserById(a.authId, { ban_duration: '1h' })).error
    ).toBeNull()
    try {
      expect(await (await raw('rpc/get_session_context', token, {})).json()).toBeNull()
    } finally {
      await admin.auth.admin.updateUserById(a.authId, { ban_duration: 'none' })
      await signInAgain('customerB')
    }
  })
  it('does not retain aal2 database access after the verified factor is removed', async () => {
    if (!financeFactorId) throw Error('Real MFA verification is required for this check')
    const token = fixture.accounts.finance.accessToken
    const removed = await admin.auth.admin.mfa.deleteFactor({
      userId: fixture.accounts.finance.authId,
      id: financeFactorId
    })
    expect(removed.error).toBeNull()
    expect(await (await raw(`payments?select=id&id=eq.${paymentId}`, token)).json()).toEqual([])
  })
})
