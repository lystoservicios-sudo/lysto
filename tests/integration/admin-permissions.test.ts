import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { chromium } from '@playwright/test'
import { createFixtureAccounts, type AccountName } from './fixtures'
import { fixtureCookieHeader, startTestApp } from './http'
import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'

describe('administrative permissions and atomic audit', () => {
  let pending: ReturnType<typeof createFixtureAccounts>
  let fixture: Awaited<ReturnType<typeof createFixtureAccounts>>
  let app: Awaited<ReturnType<typeof startTestApp>> | undefined
  let pendingApp: ReturnType<typeof startTestApp> | undefined
  let database: Client | undefined
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
        await database?.end()
      } finally {
        await pending?.cleanup()
      }
    }
  }, 180000)
  async function request(
    path: string,
    actor: AccountName = 'owner',
    method = 'GET',
    body?: unknown
  ) {
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
  async function current(actor: AccountName) {
    const result = await request('/api/admin/permissions')
    expect(result.status).toBe(200)
    const body = await result.json()
    const row = body.items.find(
      (item: { id: string }) => item.id === fixture.accounts[actor].entityId
    )
    expect(row).toBeTruthy()
    return row as { id: string; version: number; permissions: string[] }
  }
  async function change(
    target: AccountName,
    permissions: string[],
    version?: number,
    actor: AccountName = 'owner'
  ) {
    const row = await current(target)
    return request('/api/admin/permissions', actor, 'PUT', {
      adminProfileId: row.id,
      expectedVersion: version ?? row.version,
      permissions,
      reason: 'Cambio de permisos para el ensayo T09'
    })
  }
  it.each(['operations', 'finance', 'quality', 'customerA', 'professionalApproved'] as const)(
    'refuses permission administration to %s',
    async (actor) => {
      expect((await request('/api/admin/permissions', actor)).status).toBe(403)
      expect((await request('/api/admin/permissions', actor, 'PUT', {})).status).toBe(403)
    }
  )
  it('persists the permitted change with actor, reason and before/after in one transaction', async () => {
    const row = await current('operations')
    expect(row.permissions).toEqual(['operations'])
    const result = await change('operations', ['operations', 'quality'], row.version)
    expect(result.status).toBe(200)
    expect((await current('operations')).permissions.sort()).toEqual(['operations', 'quality'])
    const audit = (
      await database!.query(
        "select actor_profile_id,metadata from public.admin_audit_logs where entity_id=$1 and action='admin.permissions.updated' order by created_at desc limit 1",
        [row.id]
      )
    ).rows[0]
    expect(audit.actor_profile_id).toBe(fixture.accounts.owner.profileId)
    expect(audit.metadata.before).toEqual(['operations'])
    expect(audit.metadata.after.sort()).toEqual(['operations', 'quality'])
    expect(audit.metadata.reason).toBe('Cambio de permisos para el ensayo T09')
    expect((await change('operations', ['operations'], row.version)).status).toBe(409)
  })
  it('paginates the administrator directory without dropping or duplicating accounts', async () => {
    const ids: string[] = []
    let cursor: string | null = null
    for (let index = 0; index < 4; index++) {
      const result = await request('/api/admin/permissions?pageSize=1' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''))
      expect(result.status).toBe(200)
      const page = await result.json()
      expect(page.items).toHaveLength(1)
      expect(page.total).toBe(4)
      ids.push(page.items[0].id)
      cursor = page.nextCursor
      if (index < 3) expect(cursor).toEqual(expect.any(String))
    }
    expect(cursor).toBeNull()
    expect(new Set(ids).size).toBe(4)
  })
  it('rejects missing reasons, forged actors and direct audit tampering', async () => {
    const row = await current('operations')
    expect(
      (
        await request('/api/admin/permissions', 'owner', 'PUT', {
          adminProfileId: row.id,
          expectedVersion: row.version,
          permissions: ['operations']
        })
      ).status
    ).toBe(400)
    expect(
      (
        await request('/api/admin/permissions', 'owner', 'PUT', {
          adminProfileId: row.id,
          expectedVersion: row.version,
          permissions: ['operations'],
          reason: 'Validación de actor falso',
          actorProfileId: fixture.accounts.quality.profileId
        })
      ).status
    ).toBe(400)
    expect(
      (
        await fixture.accounts.owner.client
          .from('admin_audit_logs')
          .insert({
            actor_profile_id: fixture.accounts.quality.profileId,
            action: 'admin.permissions.updated',
            entity_type: 'admin_profile',
            entity_id: row.id,
            metadata: {}
          })
      ).error?.code
    ).toBe('42501')
    expect(
      (
        await fixture.accounts.owner.client
          .from('admin_audit_logs')
          .update({ metadata: {} })
          .eq('entity_id', row.id)
      ).error?.code
    ).toBe('42501')
    expect(
      (
        await fixture.accounts.owner.client
          .from('admin_audit_logs')
          .delete()
          .eq('entity_id', row.id)
      ).error?.code
    ).toBe('42501')
  })
  it('refuses removal of the final usable owner', async () => {
    expect((await change('owner', ['operations'])).status).toBe(409)
    expect((await current('owner')).permissions).toContain('owner')
  })
  it('does not count a banned secondary owner as a usable recovery account', async () => {
    expect((await change('quality', ['quality', 'owner'])).status).toBe(200)
    try {
      await database!.query(
        "update auth.users set banned_until=now()+interval '1 hour' where id=$1",
        [fixture.accounts.quality.authId]
      )
      expect((await change('owner', ['operations'])).status).toBe(409)
    } finally {
      await database!.query('update auth.users set banned_until=null where id=$1', [
        fixture.accounts.quality.authId
      ])
      expect((await change('quality', ['quality'])).status).toBe(200)
    }
  })
  it('rejects a queued mutation if its owner permission was removed while waiting', async () => {
    const row = await current('operations')
    await database!.query('select pg_advisory_lock(537975841827451329::bigint)')
    let pendingChange: Promise<Response> | undefined
    try {
      pendingChange = request('/api/admin/permissions', 'owner', 'PUT', {
        adminProfileId: row.id,
        expectedVersion: row.version,
        permissions: ['finance'],
        reason: 'Operación en espera de revisión de permisos'
      })
      const deadline = Date.now() + 15000
      let waiting = false
      while (Date.now() < deadline) {
        waiting = (
          await database!.query(
            "select exists(select 1 from pg_stat_activity where pid<>pg_backend_pid() and wait_event='advisory' and query like '%change_admin_permissions%') as waiting"
          )
        ).rows[0].waiting
        if (waiting) break
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      expect(waiting).toBe(true)
      await database!.query(
        "delete from private.admin_profile_permissions where admin_profile_id=$1 and permission='owner'",
        [fixture.accounts.owner.entityId]
      )
      await database!.query('select pg_advisory_unlock(537975841827451329::bigint)')
      expect((await pendingChange).status).toBe(403)
    } finally {
      await database!.query('select pg_advisory_unlock(537975841827451329::bigint)')
      await pendingChange?.catch(() => undefined)
      await database!.query(
        "insert into private.admin_profile_permissions(admin_profile_id,permission) values($1,'owner') on conflict do nothing",
        [fixture.accounts.owner.entityId]
      )
    }
    expect(await current('operations')).toMatchObject({
      permissions: row.permissions,
      version: row.version
    })
  }, 90000)
  it('serializes two changes to the same version and rejects the stale mutation', async () => {
    const row = await current('operations')
    const results = await Promise.all(
      [['operations'], ['quality']].map((permissions) =>
        request('/api/admin/permissions', 'owner', 'PUT', {
          adminProfileId: row.id,
          expectedVersion: row.version,
          permissions,
          reason: 'Ensayo de modificaciones concurrentes'
        })
      )
    )
    expect(results.map((result) => result.status).sort()).toEqual([200, 409])
    expect((await change('operations', ['operations', 'quality'])).status).toBe(200)
  })
  it('rolls permission changes back when writing the audit fails', async () => {
    const row = await current('operations')
    await database!.query(
      `create function private.test_t09_reject_audit() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Injected audit failure'; end; $$`
    )
    try {
      await database!.query(
        `create trigger test_t09_reject_audit before insert on public.admin_audit_logs for each row when (new.action='admin.permissions.updated' and new.entity_id='${row.id}'::uuid) execute function private.test_t09_reject_audit()`
      )
      expect((await change('operations', ['finance'], row.version)).status).toBe(503)
      expect(await current('operations')).toMatchObject({
        version: row.version,
        permissions: row.permissions
      })
    } finally {
      await database!.query(
        'drop trigger if exists test_t09_reject_audit on public.admin_audit_logs'
      )
      await database!.query('drop function private.test_t09_reject_audit()')
    }
  })
  it('paginates audit by scope and never exposes arbitrary metadata or other scopes', async () => {
    const actor = fixture.accounts.owner.profileId
    await database!.query(
      `insert into public.admin_audit_logs(actor_profile_id,action,entity_type,metadata) values
      ($1,'payment.refund.requested','payment_refund_request','{"amount":100,"access_token":"PRIVATE_TOKEN_T09","customer_email":"private@lysto.test"}'),
      ($1,'payment.refund.requested','payment_refund_request','{"amount":200}'),
      ($1,'quality.case_opened','warranty_claim','{"status":"open"}')`,
      [actor]
    )
    const finance = await request('/api/admin/audit?pageSize=1', 'finance')
    expect(finance.status).toBe(200)
    const body = await finance.json()
    expect(body.items).toHaveLength(1)
    expect(body.items[0].action).toBe('payment.refund.requested')
    expect(body.total).toBe(2)
    expect(body.nextCursor).toEqual(expect.any(String))
    const next = await request(
      '/api/admin/audit?pageSize=1&cursor=' + encodeURIComponent(body.nextCursor),
      'finance'
    )
    expect(next.status).toBe(200)
    const nextPage = await next.json()
    expect(nextPage.items).toHaveLength(1)
    expect(nextPage.items[0].id).not.toBe(body.items[0].id)
    expect(nextPage.nextCursor).toBeNull()
    expect(
      (await request('/api/admin/audit?cursor=' + encodeURIComponent(body.nextCursor), 'quality'))
        .status
    ).toBe(400)
    expect(JSON.stringify(body)).not.toContain('PRIVATE_TOKEN_T09')
    expect(JSON.stringify(body)).not.toContain('private@lysto.test')
    const quality = await request('/api/admin/audit', 'quality')
    expect(quality.status).toBe(200)
    expect(
      (await quality.json()).items.every(
        (item: { action: string }) => !item.action.startsWith('payment.')
      )
    ).toBe(true)
    expect((await request('/api/admin/audit', 'customerA')).status).toBe(403)
    expect(
      (await fixture.accounts.finance.client.from('admin_audit_logs').select('metadata')).error
        ?.code
    ).toBe('42501')
  })
  it('saves permissions in the browser and reloads the persisted audit trail', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const context = await browser.newContext()
      const cookies = await fixtureCookieHeader(fixture.accounts.owner)
      await context.addCookies(
        cookies.split('; ').map((cookie) => {
          const at = cookie.indexOf('=')
          return {
            name: cookie.slice(0, at),
            value: cookie.slice(at + 1),
            url: app!.baseURL,
            sameSite: 'Lax' as const
          }
        })
      )
      const page = await context.newPage()
      await page.goto(app!.baseURL + '/admin/configuracion')
      await page
        .getByLabel('Cuenta administrativa')
        .selectOption(fixture.accounts.operations.entityId)
      await page.getByLabel('Finanzas', { exact: true }).check()
      await page
        .getByLabel('Motivo del cambio', { exact: true })
        .fill('Habilitación financiera validada desde el navegador T09')
      await page.getByRole('button', { name: 'Guardar permisos', exact: true }).click()
      await page.getByText('Permisos guardados y registrados en auditoría.').waitFor()
      await page.reload()
      await page
        .getByLabel('Cuenta administrativa')
        .selectOption(fixture.accounts.operations.entityId)
      expect(await page.getByLabel('Finanzas', { exact: true }).isChecked()).toBe(true)
      expect(await page.getByText('Datos demostrativos.', { exact: false }).count()).toBe(0)
      await page.goto(app!.baseURL + '/admin/auditoria')
      const entry = page
        .locator('article')
        .filter({ hasText: 'Habilitación financiera validada desde el navegador T09' })
      await entry.locator('summary').click()
      expect(await entry.getByText('Permisos anteriores', { exact: true }).isVisible()).toBe(true)
      expect(await entry.getByText('Permisos nuevos', { exact: true }).isVisible()).toBe(true)
      expect(
        await entry
          .getByText('Habilitación financiera validada desde el navegador T09', { exact: true })
          .isVisible()
      ).toBe(true)
    } finally {
      await browser.close()
    }
  }, 120000)
})
