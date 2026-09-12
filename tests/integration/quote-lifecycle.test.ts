import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { createFixtureAccounts, type AccountName } from './fixtures'
import { fixtureCookieHeader, startTestApp } from './http'
import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'
import { TIME_WINDOWS } from '../../lib/domain/constants'
import { defaultQuotePolicy } from '../../lib/pricing/service-quote'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

describe('versioned service quote lifecycle', () => {
  let pending: ReturnType<typeof createFixtureAccounts>
  let fixture: Awaited<ReturnType<typeof createFixtureAccounts>>
  let database: Client | undefined
  let pendingApp: ReturnType<typeof startTestApp> | undefined
  let app: Awaited<ReturnType<typeof startTestApp>> | undefined
  beforeAll(async () => {
    pending = createFixtureAccounts()
    fixture = await pending
    const target = assertTestEnvironment(process.env, readTestIdentity(process.env))
    database = new Client({
      connectionString: target.databaseUrl,
      connectionTimeoutMillis: 5000,
      query_timeout: 10000
    })
    await database.connect()
    pendingApp = startTestApp()
    app = await pendingApp
  }, 300000)
  afterAll(async () => {
    try {
      await (app ?? (await pendingApp?.catch(() => undefined)))?.stop()
    } finally {
      try {
        if (database && fixture) {
          const target = assertTestEnvironment(process.env, readTestIdentity(process.env))
          const storage = createClient(target.apiUrl, process.env.LYSTO_TEST_SERVICE_ROLE_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false }
          })
          const profiles = Object.values(fixture.accounts).map((account) => account.profileId)
          const uploads = (
            await database.query(
              'select quarantine_path,output_bucket,output_path from private.upload_intents where owner_profile_id=any($1::uuid[])',
              [profiles]
            )
          ).rows
          for (const upload of uploads)
            for (const [bucket, path] of [
              ['upload-quarantine', upload.quarantine_path],
              [upload.output_bucket, upload.output_path]
            ]) {
              const result = await storage.storage.from(bucket).remove([path])
              if (result.error) throw new Error('Owned quote upload cleanup failed')
            }
          await database.query(
            'delete from private.upload_intents where owner_profile_id=any($1::uuid[])',
            [profiles]
          )
          await database.query(
            'delete from private.request_upload_drafts where owner_profile_id=any($1::uuid[])',
            [profiles]
          )
          await database.query(
            'delete from public.service_quotes where customer_id=any($1::uuid[])',
            [[fixture.accounts.customerA.entityId, fixture.accounts.customerB.entityId]]
          )
          await database.query(
            'delete from public.service_requests where customer_id=any($1::uuid[])',
            [[fixture.accounts.customerA.entityId, fixture.accounts.customerB.entityId]]
          )
          await database.query(
            'update private.quote_policy_current set policy_id=null where policy_id in (select id from private.quote_policy_versions where created_by=$1)',
            [fixture.accounts.finance.profileId]
          )
          await database.query('delete from private.quote_policy_versions where created_by=$1', [
            fixture.accounts.finance.profileId
          ])
          await database.query(
            "delete from public.admin_audit_logs where actor_profile_id=any($1::uuid[]) and action like 'pricing.%'",
            [Object.values(fixture.accounts).map((a) => a.profileId)]
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
  async function request(path: string, actor: AccountName, method: string, body?: unknown) {
    return fetch(new URL(path, app!.baseURL), {
      method,
      redirect: 'manual',
      headers: {
        Origin: app!.baseURL,
        Cookie: await fixtureCookieHeader(fixture.accounts[actor]),
        'Content-Type': 'application/json'
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(90000)
    })
  }
  function input() {
    return {
      issue: 'mantenimiento',
      urgency: 'flexible',
      propertyType: 'house',
      access: {},
      equipment: { capacity: 3000, technology: 'conventional' },
      address: { street: 'Corrientes', number: '1240', city: 'CABA', province: 'CABA' },
      preferredDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      timeWindow: TIME_WINDOWS[1],
      materials: [],
      materialsConfirmed: true,
      save: true,
      customerId: fixture.accounts.customerA.entityId,
      manualRoute: {
        source: 'manual',
        origin: 'Obelisco, CABA',
        destination: 'Corrientes 1240, CABA',
        province: 'CABA',
        outboundKm: 5,
        returnKm: 5,
        outboundMinutes: 10,
        returnMinutes: 10,
        tolls: 0,
        tollsVerified: true,
        measuredAt: new Date().toISOString()
      },
      manualRouteReason: 'Relevamiento de prueba del trayecto y peajes para este domicilio'
    }
  }
  async function savedQuote(overrides: Record<string, unknown> = {}) {
    const response = await request('/api/pricing/quote', 'operations', 'POST', {
      ...input(),
      ...overrides
    })
    expect(response.status).toBe(200)
    const result = await response.json()
    return (
      await database!.query('select * from public.service_quotes where id=$1', [result.quoteId])
    ).rows[0]
  }
  it('rejects customer money and operator claims of Google provenance', async () => {
    expect(
      (await request('/api/pricing/quote', 'customerA', 'POST', { ...input(), total: 1 })).status
    ).toBe(400)
    const body = input()
    // Use the legacy shape so this regression exercises the provenance guard itself.
    const { manualRouteReason: unused, ...legacy } = body
    void unused
    expect(
      (
        await request('/api/pricing/quote', 'operations', 'POST', {
          ...legacy,
          manualRoute: { ...body.manualRoute, source: 'google' }
        })
      ).status
    ).toBe(400)
  })
  it('requires a recorded reason for a manual route', async () => {
    const { manualRouteReason: unused, ...body } = input()
    void unused
    expect((await request('/api/pricing/quote', 'operations', 'POST', body)).status).toBe(400)
  })
  it('persists an attributable preliminary version without commercial approval', async () => {
    const response = await request('/api/pricing/quote', 'operations', 'POST', input())
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.quote.readyToOffer).toBe(false)
    const row = (
      await database!.query('select * from public.service_quotes where id=$1', [result.quoteId])
    ).rows[0]
    expect(row).toMatchObject({
      revision: 1,
      version: 1,
      created_by: fixture.accounts.operations.profileId,
      status: 'needs_review'
    })
    expect(row.root_quote_id).toBe(row.id)
    expect(row.policy_snapshot.approvedUntil).toBe(null)
    expect(
      (
        await request('/api/pricing/quotes', 'operations', 'PATCH', {
          quoteId: row.id,
          expectedVersion: row.version,
          reason: 'Revisión local completa del alcance solicitado'
        })
      ).status
    ).toBe(400)
  })
  it('retires unversioned review so a direct RPC cannot bypass tariff approval', async () => {
    const result = await fixture.accounts.operations.client.rpc('review_service_quote', {
      p_quote_id: '00000000-0000-4000-8000-000000000000',
      p_reason: 'Revisión completa de alcance y costos de prueba'
    })
    expect(result.error?.code).toBe('42501')
  })
  it('requires a versioned finance decision and preserves its source', async () => {
    const current = await (await request('/api/pricing/policy', 'finance', 'GET')).json()
    expect(current.revision).toBe(0)
    const body = {
      policy: {
        ...defaultQuotePolicy,
        version: `test-${fixture.accounts.finance.authId}`,
        paymentCostRate: 0.01,
        approvedUntil: new Date(Date.now() + 86400000).toISOString().slice(0, 10)
      },
      expectedRevision: 0,
      reason: 'Validación económica exclusivamente para el entorno desechable'
    }
    expect((await request('/api/pricing/policy', 'operations', 'PUT', body)).status).toBe(403)
    const saved = await request('/api/pricing/policy', 'finance', 'PUT', body)
    expect(saved.status).toBe(200)
    expect((await saved.json()).revision).toBe(1)
    expect((await request('/api/pricing/policy', 'finance', 'PUT', body)).status).toBe(409)
  })
  it('validates policy value types even when finance calls the RPC directly', async () => {
    const current = await (await request('/api/pricing/policy', 'finance', 'GET')).json()
    try {
      const result = await fixture.accounts.finance.client.rpc('update_quote_policy_v2', {
        p_policy: {
          ...current.policy,
          version: current.policy.version + '-invalid',
          source: { forged: 'not a source string' }
        },
        p_expected_revision: current.revision,
        p_reason: 'Invalid source shape tested through direct authenticated RPC'
      })
      expect(result.error?.code).toBe('22023')
    } finally {
      await database!.query(
        'update private.quote_policy_current set policy_id=$1 where singleton',
        [current.id]
      )
      await database!.query(
        "delete from private.quote_policy_versions where created_by=$1 and policy->>'version'=$2",
        [fixture.accounts.finance.profileId, current.policy.version + '-invalid']
      )
    }
  })
  it('creates one linked revision under competing recalculations and rejects the old version', async () => {
    const initial = await savedQuote()
    const body = {
      ...input(),
      previousQuoteId: initial.id,
      expectedVersion: initial.version,
      revisionReason: 'Relevamiento actualizado de materiales y trayecto'
    }
    const results = await Promise.all([
      request('/api/pricing/quote', 'operations', 'POST', body),
      request('/api/pricing/quote', 'operations', 'POST', body)
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    const history = (
      await database!.query(
        'select * from public.service_quotes where root_quote_id=$1 order by revision',
        [initial.id]
      )
    ).rows
    expect(history).toHaveLength(2)
    expect(history[0].status).toBe('superseded')
    expect(history[1]).toMatchObject({
      previous_quote_id: initial.id,
      customer_id: initial.customer_id,
      revision: 2
    })
    expect(
      (
        await request('/api/customer/request/submit', 'customerA', 'POST', {
          quoteId: initial.id,
          expectedVersion: initial.version
        })
      ).status
    ).toBe(409)
  })
  it('requires current complete inputs before review and serializes operator decisions', async () => {
    for (const override of [
      { materialsConfirmed: false },
      { manualRoute: { ...input().manualRoute, tollsVerified: false } },
      {
        manualRoute: {
          ...input().manualRoute,
          measuredAt: new Date(Date.now() - 31 * 60000).toISOString()
        }
      }
    ]) {
      const q = await savedQuote(override)
      expect(
        (
          await request('/api/pricing/quotes', 'operations', 'PATCH', {
            quoteId: q.id,
            expectedVersion: q.version,
            reason: 'Revisión de alcance y costos relevados para la visita'
          })
        ).status
      ).toBe(400)
    }
    const q = await savedQuote()
    const body = {
      quoteId: q.id,
      expectedVersion: q.version,
      reason: 'Revisión de alcance y costos relevados para la visita'
    }
    const results = await Promise.all([
      request('/api/pricing/quotes', 'operations', 'PATCH', body),
      request('/api/pricing/quotes', 'operations', 'PATCH', body)
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    expect(
      (
        await database!.query(
          'select status,version,reviewed_by from public.service_quotes where id=$1',
          [q.id]
        )
      ).rows[0]
    ).toMatchObject({
      status: 'ready',
      version: 2,
      reviewed_by: fixture.accounts.operations.profileId
    })
  })
  it('accepts once and returns the same persisted request and job after a lost response', async () => {
    const q = await savedQuote()
    expect(
      (
        await request('/api/pricing/quotes', 'operations', 'PATCH', {
          quoteId: q.id,
          expectedVersion: 1,
          reason: 'Revisión del alcance final y todos sus costos'
        })
      ).status
    ).toBe(200)
    const body = { quoteId: q.id, expectedVersion: 2 }
    expect((await request('/api/customer/request/submit', 'customerB', 'POST', body)).status).toBe(
      404
    )
    const results = await Promise.all([
      request('/api/customer/request/submit', 'customerA', 'POST', body),
      request('/api/customer/request/submit', 'customerA', 'POST', body)
    ])
    expect(results.map((r) => r.status)).toEqual([200, 200])
    const [first, retry] = await Promise.all(results.map((r) => r.json()))
    expect(retry).toEqual(first)
    expect(first.result.request_id).toMatch(/^[a-f0-9-]{36}$/)
    expect(first.result.job_id).toMatch(/^[a-f0-9-]{36}$/)
    const persisted = (
      await database!.query(
        'select quote,acceptance_result from public.service_quotes where id=$1',
        [q.id]
      )
    ).rows[0]
    expect(persisted.quote).toEqual(q.quote)
    expect(persisted.acceptance_result).toEqual(first.result)
    expect(
      (
        await database!.query('select count(*)::int n from public.jobs where request_id=$1', [
          first.result.request_id
        ])
      ).rows[0].n
    ).toBe(1)
  })
  it('rejects past visits, incomplete coverage, unknown money and direct client writers', async () => {
    expect(
      (
        await request('/api/pricing/quote', 'operations', 'POST', {
          ...input(),
          preferredDate: '2020-01-01'
        })
      ).status
    ).toBe(400)
    for (const forged of [
      { currency: 'USD' },
      { actorId: fixture.accounts.owner.profileId },
      { materials: [{ description: 'Fracción inválida', unitPrice: 1.001, quantity: 1 }] }
    ])
      expect(
        (await request('/api/pricing/quote', 'operations', 'POST', { ...input(), ...forged }))
          .status
      ).toBe(400)
    const q = await savedQuote({ manualRoute: { ...input().manualRoute, province: 'other' } })
    expect(
      (
        await request('/api/pricing/quotes', 'operations', 'PATCH', {
          quoteId: q.id,
          expectedVersion: 1,
          reason: 'Revisión de una dirección fuera de la cobertura'
        })
      ).status
    ).toBe(400)
    const result = await fixture.accounts.customerA.client.rpc('persist_calculated_quote', {
      p_actor_user_id: fixture.accounts.owner.authId,
      p_actor_session_id: '00000000-0000-4000-8000-000000000000',
      p_customer_id: fixture.accounts.customerA.entityId,
      p_payload: {}
    })
    expect(result.error?.code).toBe('42501')
  })
  it('requires recalculation after a tariff change and preserves accepted snapshots', async () => {
    const q = await savedQuote()
    expect(
      (
        await request('/api/pricing/quotes', 'operations', 'PATCH', {
          quoteId: q.id,
          expectedVersion: 1,
          reason: 'Revisión del alcance antes del cambio de tarifa'
        })
      ).status
    ).toBe(200)
    const current = await (await request('/api/pricing/policy', 'finance', 'GET')).json()
    expect(
      (
        await request('/api/pricing/policy', 'finance', 'PUT', {
          policy: { ...current.policy, version: current.policy.version + '-next' },
          expectedRevision: current.revision,
          reason: 'Nueva versión de la política del entorno de pruebas'
        })
      ).status
    ).toBe(200)
    expect(
      (
        await request('/api/customer/request/submit', 'customerA', 'POST', {
          quoteId: q.id,
          expectedVersion: 2
        })
      ).status
    ).toBe(400)
    const accepted = (
      await database!.query(
        "select * from public.service_quotes where customer_id=$1 and status='accepted' limit 1",
        [fixture.accounts.customerA.entityId]
      )
    ).rows[0]
    const retry = await request('/api/customer/request/submit', 'customerA', 'POST', {
      quoteId: accepted.id,
      expectedVersion: 2
    })
    expect(retry.status).toBe(200)
    expect((await retry.json()).result).toEqual(accepted.acceptance_result)
  })
  it('paginates quotes without mixing identities or silently truncating their history', async () => {
    const first = await (
      await request('/api/pricing/quotes?pageSize=2', 'operations', 'GET')
    ).json()
    expect(first.quotes).toHaveLength(2)
    expect(first.total).toBeGreaterThan(2)
    expect(first.nextCursor).toBeTypeOf('string')
    const next = await (
      await request(
        `/api/pricing/quotes?pageSize=2&cursor=${first.nextCursor}`,
        'operations',
        'GET'
      )
    ).json()
    expect(next.quotes).toHaveLength(2)
    expect(
      next.quotes.some((q: { id: string }) =>
        first.quotes.some((old: { id: string }) => old.id === q.id)
      )
    ).toBe(false)
    expect(
      (await request(`/api/pricing/quotes?cursor=${first.nextCursor}`, 'customerA', 'GET')).status
    ).toBe(400)
    expect(
      (await (await request('/api/pricing/quotes', 'customerB', 'GET')).json()).quotes
    ).toEqual([])
  })
  it('recovers an accepted quote in the browser when the acceptance response is lost', async () => {
    const q = await savedQuote()
    expect(
      (
        await request('/api/pricing/quotes', 'operations', 'PATCH', {
          quoteId: q.id,
          expectedVersion: 1,
          reason: 'Revisión del presupuesto para aceptación en navegador'
        })
      ).status
    ).toBe(200)
    const browser = await chromium.launch({ headless: true })
    try {
      const context = await browser.newContext()
      const cookie = await fixtureCookieHeader(fixture.accounts.customerA)
      await context.addCookies(
        cookie.split('; ').map((entry) => {
          const index = entry.indexOf('=')
          return {
            name: entry.slice(0, index),
            value: decodeURIComponent(entry.slice(index + 1)),
            url: app!.baseURL
          }
        })
      )
      const page = await context.newPage()
      let acceptedOnServer = false
      await page.route('**/api/customer/request/submit', async (route) => {
        const response = await route.fetch()
        acceptedOnServer = response.status() === 200
        await route.abort('failed')
      })
      await page.goto(new URL('/app/presupuestos', app!.baseURL).href)
      const detail = page.locator(`details[data-quote-id="${q.id}"]`)
      await detail.locator('summary').click()
      await detail.getByRole('button', { name: 'Aceptar y solicitar profesional' }).click()
      await detail.getByRole('link', { name: 'Ver solicitud' }).waitFor()
      expect(acceptedOnServer).toBe(true)
      await page.reload()
      await page.locator(`details[data-quote-id="${q.id}"]`).locator('summary').click()
      await page
        .locator(`details[data-quote-id="${q.id}"]`)
        .getByRole('link', { name: 'Ver solicitud' })
        .waitFor()
    } finally {
      await browser.close()
    }
  }, 120000)
  it('carries only the customer selected verified photos through revision and acceptance', async () => {
    const bytes = await sharp({
      create: { width: 40, height: 40, channels: 3, background: '#abcdef' }
    })
      .png()
      .toBuffer()
    const sign = await request('/api/uploads/sign', 'customerA', 'POST', {
      kind: 'request-photo',
      mimeType: 'image/png',
      sizeBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex')
    })
    expect(sign.status).toBe(200)
    const handle = await sign.json()
    const uploaded = await fixture.accounts.customerA.client.storage
      .from(handle.bucket)
      .uploadToSignedUrl(handle.path, handle.token, bytes, { contentType: 'image/png' })
    expect(uploaded.error).toBe(null)
    expect(
      (await request('/api/uploads/finalize', 'customerA', 'POST', { intentId: handle.intentId }))
        .status
    ).toBe(200)
    const {
      manualRoute: unused,
      manualRouteReason: unusedReason,
      customerId: unusedCustomer,
      ...body
    } = input()
    void unused
    void unusedReason
    void unusedCustomer
    const customerBody = { ...body, materialsConfirmed: false, uploadIntentIds: [handle.intentId] }
    const pendingPhoto = await (
      await request('/api/uploads/sign', 'customerA', 'POST', {
        kind: 'request-photo',
        draftId: handle.draftId,
        mimeType: 'image/png',
        sizeBytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex')
      })
    ).json()
    expect(
      (
        await request('/api/pricing/quote', 'customerA', 'POST', {
          ...customerBody,
          uploadIntentIds: [pendingPhoto.intentId]
        })
      ).status
    ).toBe(403)
    expect((await request('/api/pricing/quote', 'customerB', 'POST', customerBody)).status).toBe(
      403
    )
    const saved = await request('/api/pricing/quote', 'customerA', 'POST', customerBody)
    expect(saved.status).toBe(200)
    const first = await saved.json()
    const revised = await savedQuote({
      previousQuoteId: first.quoteId,
      expectedVersion: 1,
      revisionReason: 'Revisión técnica de las fotografías y alcance confirmado'
    })
    expect(revised.upload_intent_ids).toEqual([handle.intentId])
    expect(
      (
        await request('/api/pricing/quotes', 'operations', 'PATCH', {
          quoteId: revised.id,
          expectedVersion: 1,
          reason: 'Revisión completa con fotografías verificadas'
        })
      ).status
    ).toBe(200)
    const accept = await request('/api/customer/request/submit', 'customerA', 'POST', {
      quoteId: revised.id,
      expectedVersion: 2
    })
    expect(accept.status).toBe(200)
    const accepted = await accept.json()
    expect(
      (
        await database!.query('select id from public.request_media where request_id=$1', [
          accepted.result.request_id
        ])
      ).rows
    ).toEqual([{ id: handle.intentId }])
    expect(
      (
        await database!.query('select entity_id from private.upload_intents where id=$1', [
          handle.intentId
        ])
      ).rows[0].entity_id
    ).toBe(accepted.result.request_id)
  })
  it('rechecks the operator permission after a calculated writer waits for a lock', async () => {
    await database!.query('select pg_advisory_lock(537975841827451329::bigint)')
    let queued: Promise<Response> | undefined
    try {
      queued = request('/api/pricing/quote', 'operations', 'POST', input())
      let waiting = false
      const deadline = Date.now() + 15000
      while (Date.now() < deadline) {
        waiting = (
          await database!.query(
            "select exists(select 1 from pg_stat_activity where pid<>pg_backend_pid() and wait_event='advisory' and query like '%persist_calculated_quote%') as waiting"
          )
        ).rows[0].waiting
        if (waiting) break
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      expect(waiting).toBe(true)
      await database!.query(
        "delete from private.admin_profile_permissions where admin_profile_id=$1 and permission='operations'",
        [fixture.accounts.operations.entityId]
      )
      await database!.query('select pg_advisory_unlock(537975841827451329::bigint)')
      expect((await queued).status).toBe(403)
    } finally {
      await database!.query('select pg_advisory_unlock(537975841827451329::bigint)')
      await queued?.catch(() => undefined)
      await database!.query(
        "insert into private.admin_profile_permissions(admin_profile_id,permission) values($1,'operations') on conflict do nothing",
        [fixture.accounts.operations.entityId]
      )
    }
  }, 90000)
  it('rolls the request, job and acceptance back if their audit cannot persist', async () => {
    const q = await savedQuote()
    expect(
      (
        await request('/api/pricing/quotes', 'operations', 'PATCH', {
          quoteId: q.id,
          expectedVersion: 1,
          reason: 'Revisión para verificar la atomicidad de aceptación'
        })
      ).status
    ).toBe(200)
    const count = (
      await database!.query(
        'select count(*)::int n from public.service_requests where customer_id=$1',
        [q.customer_id]
      )
    ).rows[0].n
    await database!.query(
      "create function private.test_t14_reject_audit() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Injected quote audit failure'; end; $$"
    )
    try {
      await database!.query(
        `create trigger test_t14_reject_audit before insert on public.admin_audit_logs for each row when (new.action='pricing.quote.accepted' and new.entity_id='${q.id}'::uuid) execute function private.test_t14_reject_audit()`
      )
      expect(
        (
          await request('/api/customer/request/submit', 'customerA', 'POST', {
            quoteId: q.id,
            expectedVersion: 2
          })
        ).status
      ).toBe(503)
      expect(
        (
          await database!.query(
            'select status,version,request_id from public.service_quotes where id=$1',
            [q.id]
          )
        ).rows[0]
      ).toMatchObject({ status: 'ready', version: 2, request_id: null })
      expect(
        (
          await database!.query(
            'select count(*)::int n from public.service_requests where customer_id=$1',
            [q.customer_id]
          )
        ).rows[0].n
      ).toBe(count)
    } finally {
      await database!.query(
        'drop trigger if exists test_t14_reject_audit on public.admin_audit_logs'
      )
      await database!.query('drop function private.test_t14_reject_audit()')
    }
  })
  it('rechecks expiry at acceptance without changing an immutable quote', async () => {
    const q = await savedQuote()
    const expired = (
      await database!.query(
        `with original as (select * from public.service_quotes where id=$1), copied as (
      select jsonb_populate_record(null::public.service_quotes,to_jsonb(original)||jsonb_build_object('id',gen_random_uuid(),'root_quote_id',null,'status','ready','reviewed_by',$2::uuid,'reviewed_at',now(),'expires_at',now()-interval '1 minute')) r from original)
      insert into public.service_quotes select (r).* from copied returning id`,
        [q.id, fixture.accounts.operations.profileId]
      )
    ).rows[0]
    expect(
      (
        await request('/api/customer/request/submit', 'customerA', 'POST', {
          quoteId: expired.id,
          expectedVersion: 1
        })
      ).status
    ).toBe(400)
  })
  it('saves a manual quote from the operator screen with its recorded reason', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const context = await browser.newContext()
      const cookie = await fixtureCookieHeader(fixture.accounts.operations)
      await context.addCookies(
        cookie.split('; ').map((entry) => {
          const index = entry.indexOf('=')
          return {
            name: entry.slice(0, index),
            value: decodeURIComponent(entry.slice(index + 1)),
            url: app!.baseURL
          }
        })
      )
      const page = await context.newPage()
      await page.goto(new URL('/admin/calculadora', app!.baseURL).href)
      await page
        .getByRole('textbox', { name: 'Identificador del cliente (para guardar)' })
        .fill(fixture.accounts.customerA.entityId)
      await page
        .getByRole('checkbox', { name: 'Cargar un traslado relevado por operaciones' })
        .check()
      await page
        .getByRole('textbox', { name: 'Fundamento del traslado manual' })
        .fill('Trayecto relevado para este domicilio por el operador de prueba')
      await page.getByRole('checkbox', { name: 'Peajes confirmados, incluso si son $0' }).check()
      await page
        .getByRole('checkbox', {
          name: 'Verifiqué este trayecto para el domicilio, fecha y horario indicados.'
        })
        .check()
      await page
        .getByRole('checkbox', {
          name: 'Confirmé los materiales del alcance, o que no se necesitan.'
        })
        .check()
      const response = page.waitForResponse(
        (r) => r.url().endsWith('/api/pricing/quote') && r.request().method() === 'POST'
      )
      await page.getByRole('button', { name: 'Guardar presupuesto', exact: true }).click()
      const saved = await response
      expect(saved.status()).toBe(200)
      const id = (await saved.json()).quoteId
      const row = (
        await database!.query(
          'select created_by,manual_route_reason from public.service_quotes where id=$1',
          [id]
        )
      ).rows[0]
      expect(row).toMatchObject({
        created_by: fixture.accounts.operations.profileId,
        manual_route_reason: 'Trayecto relevado para este domicilio por el operador de prueba'
      })
      expect(
        await page.getByText('Tarifas y parámetros de la calculadora', { exact: true }).count()
      ).toBe(0)
      await page.reload()
      await page.locator(`details[data-quote-id="${id}"]`).waitFor()
    } finally {
      await browser.close()
    }
  }, 120000)
})
