import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { chromium, type Page } from '@playwright/test'
import { createFixtureAccounts, type AccountName } from './fixtures'
import { fixtureCookieHeader, startTestApp } from './http'
import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'

describe('professional invitation and review lifecycle', () => {
  let pending: ReturnType<typeof createFixtureAccounts>
  let fixture: Awaited<ReturnType<typeof createFixtureAccounts>>
  let database: Client | undefined
  let pendingApp: ReturnType<typeof startTestApp> | undefined
  let app: Awaited<ReturnType<typeof startTestApp>> | undefined
  let storageAdmin: SupabaseClient
  let oldPolicy:
    | { enabled: boolean; terms_version: string | null; privacy_version: string | null }
    | undefined
  let policyVersion: string | undefined
  let newEmail: string | undefined
  let mailOrigin: string
  const mailIds = new Set<string>()
  beforeAll(async () => {
    pending = createFixtureAccounts()
    fixture = await pending
    const target = assertTestEnvironment(process.env, readTestIdentity(process.env))
    const api = new URL(target.apiUrl)
    mailOrigin = `${api.protocol}//${api.hostname}:${target.projectId === 'lysto_production_check' ? 56324 : 54324}`
    storageAdmin = createClient(target.apiUrl, process.env.LYSTO_TEST_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(10000) })
      }
    })
    database = new Client({
      connectionString: target.databaseUrl,
      connectionTimeoutMillis: 5000,
      query_timeout: 10000
    })
    await database.connect()
    await database.query("update public.professional_profiles set status='invited' where id=$1", [
      fixture.accounts.professionalApproved.entityId
    ])
    pendingApp = startTestApp()
    app = await pendingApp
  }, 300000)
  afterAll(async () => {
    try {
      await (app ?? (await pendingApp?.catch(() => undefined)))?.stop()
    } finally {
      try {
        if (database && fixture) {
          if (oldPolicy)
            await database.query(
              'update private.account_registration_policy set enabled=$1,terms_version=$2,privacy_version=$3 where singleton',
              [oldPolicy.enabled, oldPolicy.terms_version, oldPolicy.privacy_version]
            )
          if (policyVersion) {
            await database.query(
              'delete from private.professional_review_policies where version=any($1::text[])',
              [[policyVersion, policyVersion + '-ready']]
            )
            await database.query(
              'delete from private.account_legal_documents where version=any($1::text[])',
              [[policyVersion + '-terms', policyVersion + '-privacy']]
            )
          }
          const extraUsers = newEmail
            ? (
                await database.query(
                  'select u.id,p.id profile_id from auth.users u left join public.profiles p on p.auth_user_id=u.id where u.email=$1',
                  [newEmail]
                )
              ).rows
            : []
          const profiles = [
            ...Object.values(fixture.accounts).map((account) => account.profileId),
            ...extraUsers.map((row) => row.profile_id).filter(Boolean)
          ]
          const paths = (
            await database.query(
              'select quarantine_path,output_bucket,output_path from private.upload_intents where owner_profile_id=any($1::uuid[])',
              [profiles]
            )
          ).rows
          for (const row of paths)
            for (const [bucket, path] of [
              ['upload-quarantine', row.quarantine_path],
              [row.output_bucket, row.output_path]
            ]) {
              if ((await storageAdmin.storage.from(bucket).remove([path])).error)
                throw new Error('Owned onboarding storage cleanup failed')
            }
          await database.query(
            'delete from public.professional_documents where professional_id=any($1::uuid[])',
            [Object.values(fixture.accounts).map((account) => account.entityId)]
          )
          await database.query(
            'delete from private.upload_intents where owner_profile_id=any($1::uuid[])',
            [profiles]
          )
          const actors = [fixture.accounts.owner.profileId, fixture.accounts.operations.profileId]
          const invitations = (
            await database.query(
              'select id from public.professional_invitations where created_by=any($1::uuid[])',
              [actors]
            )
          ).rows.map((row) => row.id)
          await database.query(
            'delete from private.outbox_events where aggregate_id=any($1::uuid[])',
            [invitations]
          )
          await database.query(
            'delete from public.admin_audit_logs where entity_id=any($1::uuid[])',
            [invitations]
          )
          await database.query(
            'update public.professional_profiles set invitation_id=null where invitation_id=any($1::uuid[])',
            [invitations]
          )
          await database.query(
            'delete from public.professional_invitations where id=any($1::uuid[])',
            [invitations]
          )
          for (const row of extraUsers) {
            await database.query('delete from public.admin_audit_logs where actor_profile_id=$1', [
              row.profile_id
            ])
            if ((await storageAdmin.auth.admin.deleteUser(row.id)).error)
              throw new Error('Owned invitation Auth cleanup failed')
          }
          if (mailIds.size) {
            const response = await fetch(mailOrigin + '/api/v1/messages', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ IDs: [...mailIds] }),
              signal: AbortSignal.timeout(10000)
            })
            if (!response.ok) throw new Error('Owned invitation email cleanup failed')
          }
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
  async function invite(email: string) {
    const result = await request('/api/admin/invite-professional', 'operations', 'POST', {
      firstName: 'Profesional', lastName: 'Prueba',
      email,
      specialtySlug: 'aire_acondicionado'
    })
    expect(result.status).toBe(201)
    const body = await result.json()
    expect(body.invitation.status).toBe('queued')
    expect(JSON.stringify(body)).not.toContain('token')
    const event = (
      await database!.query(
        "select payload from private.outbox_events where aggregate_id=$1 and event_type='professional.invited'",
        [body.invitation.id]
      )
    ).rows[0]
    expect(event).toBeTruthy()
    expect(body.link).toBe(`${app!.baseURL}/pro/onboarding/${event.payload.invitation_token}`)
    expect(JSON.stringify(body.invitation)).not.toContain(event.payload.invitation_token)
    return { ...body.invitation, token: event.payload.invitation_token as string }
  }
  async function inBrowser(actor: AccountName, run: (page: Page) => Promise<void>) {
    const browser = await chromium.launch({ headless: true })
    try {
      const context = await browser.newContext()
      const cookies = await fixtureCookieHeader(fixture.accounts[actor])
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
      try {
        await run(page)
      } catch (error) {
        mkdirSync('output/production-readiness', { recursive: true })
        writeFileSync(
          `output/production-readiness/t11-browser-${actor}-failure.txt`,
          await page.locator('body').innerText()
        )
        await page.screenshot({
          path: `output/production-readiness/t11-browser-${actor}-failure.png`,
          fullPage: true
        })
        throw error
      }
    } finally {
      await browser.close()
    }
  }
  it.each(['finance', 'quality', 'customerA', 'professionalApproved'] as const)(
    'denies invitation administration to %s',
    async (actor) => {
      expect((await request('/api/admin/invite-professional', actor, 'POST', {})).status).toBe(403)
    }
  )
  it('queues a real invitation atomically and keeps the token out of administrative reads', async () => {
    const invitation = await invite(`queued+${fixture.accounts.owner.profileId}@lysto.test`)
    const persisted = (
      await database!.query(
        'select token_hash,status,created_by from public.professional_invitations where id=$1',
        [invitation.id]
      )
    ).rows[0]
    expect(persisted.status).toBe('queued')
    expect(persisted.token_hash).not.toBe(invitation.token)
    expect(invitation.token.length).toBeGreaterThanOrEqual(43)
    expect(persisted.created_by).toBe(fixture.accounts.operations.profileId)
    const audit = (
      await database!.query(
        "select actor_profile_id,metadata from public.admin_audit_logs where entity_id=$1 and action='professional.invited'",
        [invitation.id]
      )
    ).rows[0]
    expect(audit.actor_profile_id).toBe(fixture.accounts.operations.profileId)
    expect(audit.metadata.reason).toBe('Convocatoria para revisión profesional de prueba')
    expect(
      (
        await fixture.accounts.operations.client
          .from('professional_invitations')
          .select('token_hash')
      ).error?.code
    ).toBe('42501')
  })
  it('allows only the verified recipient to consume a current invitation', async () => {
    const invitation = await invite(fixture.accounts.professionalApproved.email)
    expect(
      (
        await request('/api/professional/onboarding/accept', 'customerB', 'POST', {
          token: invitation.token
        })
      ).status
    ).toBe(404)
    const accepted = await request(
      '/api/professional/onboarding/accept',
      'professionalApproved',
      'POST',
      { token: invitation.token }
    )
    expect(accepted.status).toBe(200)
    expect((await accepted.json()).status).toBe('form_started')
    expect(
      (
        await request('/api/professional/onboarding/accept', 'professionalApproved', 'POST', {
          token: invitation.token
        })
      ).status
    ).toBe(409)
    expect((await request('/api/professional/onboarding', 'professionalApproved')).status).toBe(200)
    expect(
      (await request('/api/jobs/final-report', 'professionalApproved', 'POST', {})).status
    ).toBe(403)
    expect(
      (await request('/api/admin/professionals/approve', 'professionalApproved', 'POST', {})).status
    ).toBe(403)
  })
  it('validates invitation registration without exposing the recipient or changing its state', async () => {
    const invitation = await invite(fixture.accounts.customerA.email)
    const anonymous = createClient(
      process.env.LYSTO_TEST_SUPABASE_URL!,
      process.env.LYSTO_TEST_ANON_KEY!,
      { auth: { persistSession: false } }
    )
    expect(
      (
        await anonymous.rpc('professional_invitation_matches', {
          p_token: invitation.token,
          p_email: fixture.accounts.customerA.email
        })
      ).data
    ).toBe(true)
    expect(
      (
        await anonymous.rpc('professional_invitation_matches', {
          p_token: invitation.token,
          p_email: fixture.accounts.customerB.email
        })
      ).data
    ).toBe(false)
    expect(
      (
        await request('/api/professional/onboarding/accept', 'customerA', 'POST', {
          token: invitation.token
        })
      ).status
    ).toBe(409)
    const row = (
      await database!.query(
        'select status,consumed_at from public.professional_invitations where id=$1',
        [invitation.id]
      )
    ).rows[0]
    expect(row).toEqual({ status: 'queued', consumed_at: null })
    const landing = await fetch(new URL('/pro/onboarding/' + invitation.token, app!.baseURL), {
      redirect: 'manual'
    })
    expect(landing.status).toBe(200)
    expect(landing.headers.get('referrer-policy')).toBe('no-referrer')
    expect(await landing.text()).toContain('Aceptar invitación')
  })
  it('registers a bare identity, confirms real local email and grants a role only after invitation acceptance', async () => {
    newEmail = `t11-new.${fixture.accounts.owner.profileId}@lysto.test`
    const invitation = await invite(newEmail)
    const password = 'T11-owned-' + fixture.accounts.owner.profileId + '-A1!'
    const register = await fetch(new URL('/api/professional/onboarding/register', app!.baseURL), {
      method: 'POST',
      headers: { Origin: app!.baseURL, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: invitation.token,
        email: newEmail,
        password,
        repeatPassword: password
      })
    })
    expect(register.status).toBe(200)
    const user = (
      await database!.query(
        'select id,email_confirmed_at,raw_app_meta_data from auth.users where email=$1',
        [newEmail]
      )
    ).rows[0]
    expect(user.email_confirmed_at).toBeNull()
    expect(user.raw_app_meta_data.app_role).toBe('customer')
    expect(
      (await database!.query('select id from public.profiles where auth_user_id=$1', [user.id]))
        .rows
    ).toHaveLength(0)
    const deadline = Date.now() + 30000
    let confirmationToken: string | null = null
    while (!confirmationToken && Date.now() < deadline) {
      const mailbox = await (
        await fetch(mailOrigin + '/api/v1/search?query=' + encodeURIComponent('to:' + newEmail))
      ).json()
      for (const item of mailbox.messages ?? []) {
        mailIds.add(item.ID)
        const mail = await (
          await fetch(mailOrigin + '/api/v1/message/' + encodeURIComponent(item.ID))
        ).json()
        if (!mail.To.some((to: { Address: string }) => to.Address === newEmail))
          throw new Error('Unexpected invitation mail recipient')
        const href = [...String(mail.HTML).matchAll(/href="([^"]+)"/g)]
          .map((match) => match[1].replaceAll('&amp;', '&'))
          .find((value) => value.includes('token_hash='))
        if (href && new URL(href).origin === app!.baseURL)
          confirmationToken = new URL(href).searchParams.get('token_hash')
      }
      if (!confirmationToken) await new Promise((resolve) => setTimeout(resolve, 250))
    }
    expect(confirmationToken).toBeTruthy()
    const confirmed = await fetch(new URL('/auth/confirm', app!.baseURL), {
      method: 'POST',
      redirect: 'manual',
      headers: { Origin: app!.baseURL },
      body: new URLSearchParams({ token_hash: confirmationToken! })
    })
    expect(confirmed.status).toBe(303)
    expect(new URL(confirmed.headers.get('location')!).pathname).toBe('/pro/onboarding')
    expect(
      (await database!.query('select id from public.profiles where auth_user_id=$1', [user.id]))
        .rows
    ).toHaveLength(0)
    const client = createClient(
      process.env.LYSTO_TEST_SUPABASE_URL!,
      process.env.LYSTO_TEST_ANON_KEY!,
      { auth: { persistSession: false } }
    )
    const signed = await client.auth.signInWithPassword({ email: newEmail, password })
    expect(signed.error).toBeNull()
    const cookie = await fixtureCookieHeader({
      accessToken: signed.data.session!.access_token,
      refreshToken: signed.data.session!.refresh_token
    })
    const accepted = await fetch(new URL('/api/professional/onboarding/accept', app!.baseURL), {
      method: 'POST',
      headers: { Origin: app!.baseURL, Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: invitation.token })
    })
    expect(accepted.status).toBe(200)
    expect(accepted.headers.getSetCookie().some((value) => value.includes('-auth-token'))).toBe(
      true
    )
    const profile = (
      await database!.query(
        'select p.role,pp.status from public.profiles p join public.professional_profiles pp on pp.profile_id=p.id where p.auth_user_id=$1',
        [user.id]
      )
    ).rows[0]
    expect(profile).toEqual({ role: 'professional', status: 'form_started' })
    expect(
      (
        await database!.query(
          'select * from private.customer_registration_acceptances where auth_user_id=$1',
          [user.id]
        )
      ).rows
    ).toHaveLength(0)
  }, 120000)
  it('rejects expired and cancelled invitations and records cancellation atomically', async () => {
    const expired = await invite(fixture.accounts.customerB.email)
    await database!.query(
      "update public.professional_invitations set expires_at=now()-interval '1 minute' where id=$1",
      [expired.id]
    )
    expect(
      (
        await request('/api/professional/onboarding/accept', 'customerB', 'POST', {
          token: expired.token
        })
      ).status
    ).toBe(404)
    const cancelled = await invite(fixture.accounts.customerB.email)
    expect(
      (
        await request('/api/admin/invite-professional', 'finance', 'PATCH', {
          invitationId: cancelled.id,
          expectedVersion: cancelled.version,
          reason: 'Cancelación de una convocatoria incorrecta'
        })
      ).status
    ).toBe(403)
    const response = await request('/api/admin/invite-professional', 'operations', 'PATCH', {
      invitationId: cancelled.id,
      expectedVersion: cancelled.version,
      reason: 'Cancelación de una convocatoria incorrecta'
    })
    expect(response.status).toBe(200)
    expect((await response.json()).invitation.status).toBe('cancelled')
    expect(
      (
        await request('/api/professional/onboarding/accept', 'customerB', 'POST', {
          token: cancelled.token
        })
      ).status
    ).toBe(404)
    const event = (
      await database!.query(
        "select actor_profile_id,metadata from public.admin_audit_logs where entity_id=$1 and action='professional.invitation.cancelled'",
        [cancelled.id]
      )
    ).rows[0]
    expect(event.actor_profile_id).toBe(fixture.accounts.operations.profileId)
    expect(event.metadata.from_status).toBe('queued')
    expect(event.metadata.to_status).toBe('cancelled')
  })
  it('persists an owned application draft and detects concurrent edits without self approval', async () => {
    const current = await request('/api/professional/onboarding', 'professionalApproved')
    expect(current.status).toBe(200)
    const before = await current.json()
    const category = (
      await database!.query(
        "select id from public.service_categories where slug='aire_acondicionado'"
      )
    ).rows[0].id
    const zone = (
      await database!.query('select id from public.service_zones where active order by id limit 1')
    ).rows[0].id
    const draft = {
      expectedVersion: before.version,
      firstName: 'Postulante',
      lastName: 'Prueba',
      phone: '1155551234',
      dni: '30111222',
      cuil: '20301112224',
      birthdate: '1990-01-01',
      yearsExperience: 5,
      licenseNumber: '',
      licenseEntity: '',
      hasMobility: false,
      mobilityType: '',
      bio: 'Experiencia declarada por el postulante',
      categoryIds: [category],
      zoneIds: [zone],
      tools: ['multimeter'],
      availability: [{ weekday: 1, startTime: '09:00', endTime: '17:00' }]
    }
    const saved = await request(
      '/api/professional/onboarding',
      'professionalApproved',
      'POST',
      draft
    )
    expect(saved.status).toBe(200)
    const after = await saved.json()
    expect(after.version).toBeGreaterThan(before.version)
    expect(after.status).toBe('form_started')
    const reloaded = await request('/api/professional/onboarding', 'professionalApproved')
    expect(await reloaded.json()).toMatchObject({
      firstName: 'Postulante',
      lastName: 'Prueba',
      tools: ['multimeter'],
      zoneIds: [zone],
      categoryIds: [category]
    })
    expect((await request('/api/mercadopago/account', 'professionalApproved')).status).toBe(200)
    expect((await request('/api/mercadopago/account', 'customerA')).status).toBe(403)
    expect(
      (await request('/api/professional/onboarding', 'professionalApproved', 'POST', draft)).status
    ).toBe(409)
    expect(
      (
        await request('/api/professional/onboarding', 'professionalApproved', 'POST', {
          ...draft,
          expectedVersion: after.version,
          status: 'approved'
        })
      ).status
    ).toBe(400)
    expect((await request('/api/professional/onboarding', 'customerA', 'POST', draft)).status).toBe(
      403
    )
  })
  it('persists the real professional draft from the browser outside the approved layout', async () => {
    expect(
      (await request('/api/professional/onboarding/context', 'professionalApproved')).status
    ).toBe(200)
    await inBrowser('professionalApproved', async (page) => {
      await page.goto(app!.baseURL + '/pro/onboarding')
      await page
        .getByRole('textbox', { name: 'Experiencia y presentación', exact: true })
        .fill('Borrador profesional persistido desde el navegador T11')
      await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click()
      await page.getByRole('status').filter({ hasText: 'Borrador guardado.' }).waitFor()
      await page.reload()
      expect(
        await page
          .getByRole('textbox', { name: 'Experiencia y presentación', exact: true })
          .inputValue()
      ).toBe('Borrador profesional persistido desde el navegador T11')
      expect(
        await page.getByRole('button', { name: 'Enviar postulación', exact: true }).isDisabled()
      ).toBe(true)
    })
  }, 120000)
  it('paginates actual invitations and professionals and keeps administrative dossiers private', async () => {
    expect((await request('/api/admin/professionals', 'quality')).status).toBe(403)
    const first = await (
      await request('/api/admin/professionals/invitations?pageSize=1', 'operations')
    ).json()
    expect(first.items).toHaveLength(1)
    expect(first.nextCursor).toBeTruthy()
    expect(JSON.stringify(first)).not.toContain('token')
    const second = await (
      await request(
        '/api/admin/professionals/invitations?pageSize=1&cursor=' +
          encodeURIComponent(first.nextCursor),
        'operations'
      )
    ).json()
    expect(second.items).toHaveLength(1)
    expect(second.items[0].id).not.toBe(first.items[0].id)
    expect(
      (
        await request(
          '/api/admin/professionals?cursor=' + encodeURIComponent(first.nextCursor),
          'operations'
        )
      ).status
    ).toBe(400)
    const listed = await request('/api/admin/professionals', 'operations')
    expect(listed.status).toBe(200)
    expect(
      (await listed.json()).items.some(
        (item: { id: string }) => item.id === fixture.accounts.professionalApproved.entityId
      )
    ).toBe(true)
  })
  it('accepts inspected private documents only through the bounded onboarding surface', async () => {
    const bytes = await sharp({
      create: { width: 12, height: 12, channels: 3, background: '#345678' }
    })
      .png()
      .toBuffer()
    const declaration = {
      kind: 'professional-document',
      entityId: fixture.accounts.professionalApproved.entityId,
      documentType: 'identity',
      mimeType: 'image/png',
      sizeBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex')
    }
    expect(
      (await request('/api/uploads/sign', 'professionalApproved', 'POST', declaration)).status
    ).toBe(403)
    expect(
      (
        await request(
          '/api/professional/onboarding/documents/sign',
          'professionalApproved',
          'POST',
          { ...declaration, kind: 'job-document' }
        )
      ).status
    ).toBe(400)
    const signedResponse = await request(
      '/api/professional/onboarding/documents/sign',
      'professionalApproved',
      'POST',
      declaration
    )
    expect(signedResponse.status).toBe(200)
    const signed = await signedResponse.json()
    expect(
      (
        await fixture.accounts.professionalApproved.client.storage
          .from(signed.bucket)
          .uploadToSignedUrl(signed.path, signed.token, bytes, {
            contentType: 'image/png',
            upsert: false
          })
      ).error
    ).toBeNull()
    const verified = await request(
      '/api/professional/onboarding/documents/finalize',
      'professionalApproved',
      'POST',
      { intentId: signed.intentId }
    )
    expect(verified.status).toBe(200)
    expect((await verified.json()).status).toBe('verified')
    const read = await request(
      '/api/professional/onboarding/documents/read',
      'professionalApproved',
      'POST',
      { intentId: signed.intentId }
    )
    expect(read.status).toBe(200)
    const link = await read.json()
    expect(link.expiresIn).toBe(60)
    expect((await fetch(link.url, { signal: AbortSignal.timeout(10000) })).status).toBe(200)
    expect(
      (
        await request('/api/professional/onboarding/documents/read', 'customerB', 'POST', {
          intentId: signed.intentId
        })
      ).status
    ).toBe(403)
    const document = (
      await database!.query(
        'select status,reviewed_by from public.professional_documents where id=$1',
        [signed.intentId]
      )
    ).rows[0]
    expect(document.status).toBe('pending')
    expect(document.reviewed_by).toBeNull()
  })
  it('keeps review closed without an approved policy and blocks direct approval shortcuts', async () => {
    const before = await (
      await request('/api/professional/onboarding', 'professionalApproved')
    ).json()
    const response = await request(
      '/api/professional/onboarding/submit',
      'professionalApproved',
      'POST',
      {
        expectedVersion: before.version,
        accepted: true,
        termsVersion: 'missing-policy',
        privacyVersion: 'missing-policy'
      }
    )
    expect(response.status).toBe(503)
    expect(
      (await (await request('/api/professional/onboarding', 'professionalApproved')).json()).status
    ).toBe('form_started')
    expect(
      (
        await fixture.accounts.operations.client
          .from('professional_profiles')
          .update({ status: 'approved' })
          .eq('id', fixture.accounts.professionalApproved.entityId)
      ).error?.code
    ).toBe('42501')
  })
  it('requires actual documents, explicit acceptance and attributed review before atomic approval', async () => {
    const professionalId = fixture.accounts.professionalApproved.entityId
    policyVersion = 't11-' + fixture.accounts.owner.profileId
    oldPolicy = (
      await database!.query('select * from private.account_registration_policy where singleton')
    ).rows[0]
    const category = (
      await database!.query(
        "select id from public.service_categories where slug='aire_acondicionado'"
      )
    ).rows[0].id
    await database!.query(
      "insert into private.professional_review_policies(category_id,version,required_documents,expiry_documents,required_tools,min_experience,test_only) values($1,$2,array['identity','license'],array['identity'],array['multimeter'],1,true)",
      [category, policyVersion]
    )
    for (const kind of ['terms', 'privacy'])
      await database!.query(
        'insert into private.account_legal_documents(kind,version,document_url,content_sha256,test_only) values($1,$2,$3,$4,true)',
        [
          kind,
          policyVersion + '-' + kind,
          app!.baseURL + '/documentos-prueba/' + kind,
          createHash('sha256')
            .update('DOCUMENTO EXCLUSIVO DE ENSAYO T11 ' + kind)
            .digest('hex')
        ]
      )
    await database!.query(
      'update private.account_registration_policy set enabled=true,terms_version=$1,privacy_version=$2 where singleton',
      [policyVersion + '-terms', policyVersion + '-privacy']
    )
    const initial = await (
      await request('/api/professional/onboarding', 'professionalApproved')
    ).json()
    const submission = {
      expectedVersion: initial.version,
      accepted: true,
      termsVersion: policyVersion + '-terms',
      privacyVersion: policyVersion + '-privacy'
    }
    expect(
      (
        await request('/api/professional/onboarding/submit', 'professionalApproved', 'POST', {
          ...submission,
          accepted: false
        })
      ).status
    ).toBe(400)
    expect(
      (
        await request(
          '/api/professional/onboarding/submit',
          'professionalApproved',
          'POST',
          submission
        )
      ).status
    ).toBe(400)
    // A test-only policy adjustment precedes the first successful submission.
    await database!.query(
      "update private.professional_review_policies set version=$1,required_documents=array['identity'] where category_id=$2",
      [policyVersion + '-ready', category]
    )
    const submittedResponse = await request(
      '/api/professional/onboarding/submit',
      'professionalApproved',
      'POST',
      submission
    )
    expect(submittedResponse.status).toBe(200)
    let submitted = await submittedResponse.json()
    expect(submitted.status).toBe('form_submitted')
    const returned = await request('/api/admin/professionals/review', 'operations', 'POST', {
      professionalId,
      expectedVersion: submitted.version,
      decision: 'rejected',
      reason: 'Corregir los datos declarados antes de resolver la postulación'
    })
    expect(returned.status).toBe(200)
    const returnedBody = await returned.json()
    expect(returnedBody.application.status).toBe('rejected')
    expect(returnedBody.decisionReason).toContain('Corregir los datos')
    expect(
      (await request('/api/jobs/final-report', 'professionalApproved', 'POST', {})).status
    ).toBe(403)
    const fields = Object.fromEntries(
      Object.entries(returnedBody.application).filter(
        ([key]) => !['professionalId', 'email', 'version', 'status'].includes(key)
      )
    )
    const correction = await request(
      '/api/professional/onboarding',
      'professionalApproved',
      'POST',
      {
        ...fields,
        firstName: 'Postulante corregido',
        expectedVersion: returnedBody.application.version
      }
    )
    expect(correction.status).toBe(200)
    const corrected = await correction.json()
    const resubmission = await request(
      '/api/professional/onboarding/submit',
      'professionalApproved',
      'POST',
      { ...submission, expectedVersion: corrected.version }
    )
    expect(resubmission.status).toBe(200)
    submitted = await resubmission.json()
    expect(
      (await request('/api/admin/professionals/review?professionalId=' + professionalId, 'finance'))
        .status
    ).toBe(403)
    const review = await (
      await request(
        '/api/admin/professionals/review?professionalId=' + professionalId,
        'operations'
      )
    ).json()
    const document = review.documents.find(
      (item: { documentType: string }) => item.documentType === 'identity'
    )
    expect(document.status).toBe('pending')
    expect(
      (
        await request('/api/admin/professionals/approve', 'operations', 'POST', {
          professionalId,
          expectedVersion: submitted.version,
          reason: 'Intento previo a la revisión documental'
        })
      ).status
    ).toBe(409)
    const decision = {
      professionalId,
      documentId: document.id,
      expectedVersion: submitted.version,
      decision: 'approved',
      reason: 'Revisión humana simulada exclusivamente para este ensayo',
      expiresAt: null as string | null
    }
    expect(
      (await request('/api/admin/professionals/documents/review', 'operations', 'POST', decision))
        .status
    ).toBe(400)
    decision.expiresAt = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10)
    const reviewedResponse = await request(
      '/api/admin/professionals/documents/review',
      'operations',
      'POST',
      decision
    )
    expect(reviewedResponse.status).toBe(200)
    const reviewed = await reviewedResponse.json()
    expect(reviewed.application.status).toBe('under_review')
    expect(
      reviewed.documents.find((item: { id: string }) => item.id === document.id).reviewedBy
    ).toBe(fixture.accounts.operations.profileId)
    const approve = {
      professionalId,
      expectedVersion: reviewed.application.version,
      reason: 'Aprobación de una postulación revisada de prueba'
    }
    await database!.query(
      "create function private.test_t11_reject_approval_audit() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Injected approval audit failure'; end; $$"
    )
    try {
      await database!.query(
        `create trigger test_t11_reject_approval_audit before insert on public.admin_audit_logs for each row when (new.action='professional.approved' and new.entity_id='${professionalId}'::uuid) execute function private.test_t11_reject_approval_audit()`
      )
      expect(
        (await request('/api/admin/professionals/approve', 'operations', 'POST', approve)).status
      ).toBe(503)
      const preserved = (
        await database!.query(
          'select status,version from public.professional_profiles where id=$1',
          [professionalId]
        )
      ).rows[0]
      expect(preserved).toEqual({ status: 'under_review', version: reviewed.application.version })
    } finally {
      await database!.query(
        'drop trigger if exists test_t11_reject_approval_audit on public.admin_audit_logs'
      )
      await database!.query('drop function private.test_t11_reject_approval_audit()')
    }
    await inBrowser('operations', async (page) => {
      await page.goto(app!.baseURL + '/admin/profesionales/' + professionalId)
      await page
        .getByRole('combobox', { name: 'Decisión sobre la postulación', exact: true })
        .selectOption('approved')
      await page.getByLabel('Motivo de la resolución', { exact: true }).fill(approve.reason)
      await page.getByRole('button', { name: 'Registrar resolución', exact: true }).click()
      await page.getByRole('status').filter({ hasText: 'Revisión registrada.' }).waitFor()
      await page.reload()
      expect(
        await page.getByText('Aprobado · Documentación vigente · No recibe trabajos nuevos', { exact: true }).isVisible()
      ).toBe(true)
      expect(await page.getByText('Datos demostrativos.', { exact: false }).count()).toBe(0)
    })
    const audit = (
      await database!.query(
        "select actor_profile_id,metadata from public.admin_audit_logs where action='professional.approved' and entity_id=$1",
        [professionalId]
      )
    ).rows[0]
    expect(audit.actor_profile_id).toBe(fixture.accounts.operations.profileId)
    expect(audit.metadata.from_status).toBe('under_review')
    expect(audit.metadata.to_status).toBe('approved')
    const readiness = await database!.query(
      'select private.professional_ready_for_new_work($1) as ready, private.professional_readiness_reasons($1) as reasons',
      [professionalId]
    )
    expect(readiness.rows[0].ready).toBe(false)
    expect(readiness.rows[0].reasons).toEqual(expect.arrayContaining(['foto', 'mercado_pago']))
    expect(
      (await request('/api/jobs/final-report', 'professionalApproved', 'POST', {})).status
    ).toBe(400)
  }, 120000)
  it('withdraws operational authority when required evidence expires while preserving the application', async () => {
    const professionalId = fixture.accounts.professionalApproved.entityId
    const document = (
      await database!.query(
        "select id,expires_at::text from public.professional_documents where professional_id=$1 and document_type='identity'",
        [professionalId]
      )
    ).rows[0]
    try {
      await database!.query(
        "update public.professional_documents set expires_at='2000-01-01' where id=$1",
        [document.id]
      )
      expect(
        (await request('/api/jobs/final-report', 'professionalApproved', 'POST', {})).status
      ).toBe(403)
      const context = await fixture.accounts.professionalApproved.client.rpc('get_session_context')
      expect(context.data.professional_eligible).toBe(false)
      expect((await request('/api/professional/onboarding', 'professionalApproved')).status).toBe(
        200
      )
      expect(
        (
          await database!.query('select status from public.professional_profiles where id=$1', [
            professionalId
          ])
        ).rows[0].status
      ).toBe('approved')
    } finally {
      await database!.query('update public.professional_documents set expires_at=$1 where id=$2', [
        document.expires_at,
        document.id
      ])
    }
    expect(
      (await request('/api/jobs/final-report', 'professionalApproved', 'POST', {})).status
    ).toBe(400)
  })
})
