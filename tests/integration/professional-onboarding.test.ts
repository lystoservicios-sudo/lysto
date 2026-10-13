import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { chromium, type Page } from '@playwright/test'
import { createFixtureAccounts, type AccountName, type FixtureAccount } from './fixtures'
import { fixtureCookieHeader, startTestApp } from './http'
import { clearOwnedProfessionalOnboardingOutbox } from './professional-onboarding-cleanup'
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
  let applicant: FixtureAccount
  let oldReviewPolicy: Record<string, unknown> | undefined
  let reviewCategoryId: string | undefined
  const ownedEmails = new Set<string>()
  const ownedAuthIds = new Set<string>()
  type Actor = AccountName | 'applicant' | FixtureAccount
  const account = (actor: Actor): FixtureAccount =>
    typeof actor === 'object' ? actor : actor === 'applicant' ? applicant : fixture.accounts[actor]
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
          if (reviewCategoryId && policyVersion) {
            await database.query(
              'delete from private.professional_review_policies where category_id=$1 and version=$2',
              [reviewCategoryId, policyVersion]
            )
            if (oldReviewPolicy)
              await database.query(
                'insert into private.professional_review_policies select (jsonb_populate_record(null::private.professional_review_policies,$1::jsonb)).*',
                [JSON.stringify(oldReviewPolicy)]
              )
          }
          if (policyVersion)
            await database.query(
              'delete from private.account_legal_documents where version=any($1::text[])',
              [[policyVersion + '-terms', policyVersion + '-privacy']]
            )

          // Recover only our recorded synthetic recipients if setup failed after
          // API provisioning but before the returned Auth ID was recorded.
          const extraUsers = (await database.query(
            "select u.id,p.id profile_id,pp.id professional_id from auth.users u left join public.profiles p on p.auth_user_id=u.id left join public.professional_profiles pp on pp.profile_id=p.id where (u.id=any($1::uuid[]) or u.email=any($2::text[])) and u.raw_app_meta_data->>'signup_source'='professional_invitation'",
            [[...ownedAuthIds], [...ownedEmails]]
          )).rows
          const profiles = [
            ...Object.values(fixture.accounts).map((item) => item.profileId),
            ...extraUsers.map((row) => row.profile_id).filter(Boolean)
          ]
          const professionals = [
            ...Object.values(fixture.accounts).map((item) => item.entityId),
            ...extraUsers.map((row) => row.professional_id).filter(Boolean)
          ]
          const paths = (await database.query(
            'select quarantine_path,output_bucket,output_path from private.upload_intents where owner_profile_id=any($1::uuid[])',
            [profiles]
          )).rows
          for (const row of paths)
            for (const [bucket, path] of [
              ['upload-quarantine', row.quarantine_path],
              [row.output_bucket, row.output_path]
            ])
              if ((await storageAdmin.storage.from(bucket).remove([path])).error)
                throw new Error('Owned onboarding storage cleanup failed')
          // Include an avatar derivative left after an ambiguous finalization,
          // while limiting deletion to prefixes of our exact synthetic Auth IDs.
          const avatarObjects = (await database.query(
            "select bucket_id,name from storage.objects where bucket_id in ('public-avatars','upload-quarantine') and split_part(name,'/',1)=any($1::text[])",
            [extraUsers.map((row) => row.id)]
          )).rows
          for (const row of avatarObjects)
            if ((await storageAdmin.storage.from(row.bucket_id).remove([row.name])).error)
              throw new Error('Owned onboarding avatar cleanup failed')
          await database.query(
            'delete from public.professional_documents where professional_id=any($1::uuid[])',
            [professionals]
          )
          await database.query(
            'delete from private.upload_intents where owner_profile_id=any($1::uuid[])',
            [profiles]
          )
          const invitations = (await database.query(
            'select id from public.professional_invitations where created_by=any($1::uuid[])',
            [[fixture.accounts.owner.profileId, fixture.accounts.operations.profileId]]
          )).rows.map((row) => row.id)
          await clearOwnedProfessionalOnboardingOutbox(database, {
            invitationIds: invitations,
            professionalIds: [
              fixture.accounts.professionalApproved.entityId,
              fixture.accounts.professionalSuspended.entityId,
              ...extraUsers.map((row) => row.professional_id).filter(Boolean)
            ],
            recipientProfileIds: extraUsers.map((row) => row.profile_id).filter(Boolean)
          })
          await database.query(
            'delete from public.admin_audit_logs where entity_id=any($1::uuid[]) or actor_profile_id=any($2::uuid[])',
            [[...invitations, ...professionals], extraUsers.map((row) => row.profile_id).filter(Boolean)]
          )
          await database.query(
            'update public.professional_profiles set invitation_id=null where invitation_id=any($1::uuid[])',
            [invitations]
          )
          // Remove the exact invitation before Auth: Flow3 retains an intentional
          // provisioned_auth_user_id foreign key even for cancelled invitations.
          await database.query(
            'delete from public.professional_invitations where id=any($1::uuid[])',
            [invitations]
          )
          for (const row of extraUsers) {
            let deleted = false
            for (let attempt = 0; attempt < 3 && !deleted; attempt++)
              deleted = !(await storageAdmin.auth.admin.deleteUser(row.id)).error
            if (!deleted) throw new Error('Owned invitation Auth cleanup failed')
          }
          for (const email of ownedEmails) {
            const response = await fetch(
              mailOrigin + '/api/v1/search?query=' + encodeURIComponent('to:' + email),
              { signal: AbortSignal.timeout(10000) }
            )
            if (!response.ok) throw new Error('Owned invitation mailbox lookup failed')
            const mailbox = await response.json()
            for (const item of mailbox.messages ?? []) {
              const response = await fetch(
                mailOrigin + '/api/v1/message/' + encodeURIComponent(item.ID),
                { signal: AbortSignal.timeout(10000) }
              )
              if (!response.ok) throw new Error('Owned invitation mailbox lookup failed')
              const mail = await response.json()
              if (!mail.To.some((to: { Address: string }) => to.Address === email))
                throw new Error('Unexpected invitation mail recipient')
              mailIds.add(item.ID)
            }
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
    actor: Actor = 'owner',
    method = 'GET',
    body?: unknown
  ) {
    return fetch(new URL(path, app!.baseURL), {
      method,
      redirect: 'manual',
      headers: {
        Origin: app!.baseURL,
        Cookie: await fixtureCookieHeader(account(actor)),
        'Content-Type': 'application/json'
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(90000)
    })
  }
  async function invite(label: string) {
    const email = 't11-' + label + '.' + randomUUID() + '@lysto.test'
    ownedEmails.add(email)
    const result = await request('/api/admin/invite-professional', 'operations', 'POST', {
      firstName: 'Profesional', lastName: 'Prueba', email,
      specialtySlug: 'aire_acondicionado'
    })
    expect(result.status).toBe(201)
    const body = await result.json()
    expect(body.invitation.status).toBe('queued')
    expect(body.invitation.expiresAt).toBeNull()
    expect(body.delivery).toEqual({ accepted: false, reason: 'email_not_configured' })
    for (const field of ['link', 'token', 'temporaryPassword']) {
      expect(Object.hasOwn(body, field)).toBe(false)
      expect(Object.hasOwn(body.invitation, field)).toBe(false)
    }
    const row = (
      await database!.query(
        'select i.flow_version,i.provisioned_auth_user_id,u.email_confirmed_at,u.raw_app_meta_data from public.professional_invitations i join auth.users u on u.id=i.provisioned_auth_user_id where i.id=$1 and i.created_by=$2 and i.email=$3',
        [body.invitation.id, fixture.accounts.operations.profileId, email]
      )
    ).rows[0]
    expect(row.flow_version).toBe(3)
    ownedAuthIds.add(row.provisioned_auth_user_id)
    expect(row.email_confirmed_at).not.toBeNull()
    expect(row.raw_app_meta_data?.app_role === 'professional' &&
      row.raw_app_meta_data?.signup_source === 'professional_invitation').toBe(true)
    expect((await database!.query(
      "select id from private.outbox_events where aggregate_id=$1 and event_type='professional.invited'",
      [body.invitation.id]
    )).rows).toHaveLength(0)

    // The disposable server deliberately disables external delivery. Seed known
    // credentials only on these exact synthetic Auth/invitation IDs; never read
    // or persist production passwords, plaintext delivery tokens, or mail bodies.
    // This covers provision/login/acceptance, not real Resend delivery.
    const token = randomBytes(32).toString('base64url')
    const password = 'aA1!' + randomBytes(3).toString('hex')
    const rotated = await database!.query(
      "update public.professional_invitations set token_hash=encode(extensions.digest($2::text,'sha256'),'hex') where id=$1 and provisioned_auth_user_id=$3 and flow_version=3 and consumed_at is null returning id,version",
      [body.invitation.id, token, row.provisioned_auth_user_id]
    )
    expect(rotated.rowCount).toBe(1)
    const passwordChange = await storageAdmin.auth.admin.updateUserById(
      row.provisioned_auth_user_id, { password }
    )
    if (passwordChange.error) throw new Error('Synthetic invitation credential setup failed')
    const client = createClient(
      process.env.LYSTO_TEST_SUPABASE_URL!, process.env.LYSTO_TEST_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const signed = await client.auth.signInWithPassword({ email, password })
    if (signed.error || !signed.data.session)
      throw new Error('Synthetic invited professional login failed')
    const recipient: FixtureAccount = {
      authId: row.provisioned_auth_user_id,
      profileId: row.provisioned_auth_user_id,
      entityId: row.provisioned_auth_user_id,
      email, password, client,
      accessToken: signed.data.session.access_token,
      refreshToken: signed.data.session.refresh_token
    }
    return { ...body.invitation, version: rotated.rows[0].version, token, recipient }
  }
  async function hydrateRecipient(recipient: FixtureAccount) {
    const row = (await database!.query(
      'select p.id profile_id,pp.id professional_id from public.profiles p join public.professional_profiles pp on pp.profile_id=p.id where p.auth_user_id=$1',
      [recipient.authId]
    )).rows[0]
    expect(row).toBeTruthy()
    recipient.profileId = row.profile_id
    recipient.entityId = row.professional_id
    const refreshed = await recipient.client.auth.refreshSession()
    if (refreshed.error || !refreshed.data.session)
      throw new Error('Synthetic professional session refresh failed')
    recipient.accessToken = refreshed.data.session.access_token
    recipient.refreshToken = refreshed.data.session.refresh_token
    return recipient
  }
  async function uploadDocument(documentType: string) {
    const bytes = await sharp({
      create: { width: 12, height: 12, channels: 3, background: '#345678' }
    }).png().toBuffer()
    const signedResponse = await request(
      '/api/professional/onboarding/documents/sign', 'applicant', 'POST', {
        kind: 'professional-document', entityId: applicant.entityId, documentType,
        mimeType: 'image/png', sizeBytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex')
      }
    )
    expect(signedResponse.status).toBe(200)
    const signed = await signedResponse.json()
    expect((await applicant.client.storage.from(signed.bucket).uploadToSignedUrl(
      signed.path, signed.token, bytes, { contentType: 'image/png', upsert: false }
    )).error === null).toBe(true)
    const verified = await request(
      '/api/professional/onboarding/documents/finalize', 'applicant', 'POST',
      { intentId: signed.intentId }
    )
    expect(verified.status).toBe(200)
    expect((await verified.json()).status).toBe('verified')
    return signed.intentId as string
  }
  async function inBrowser(actor: Actor, run: (page: Page) => Promise<void>) {
    const browser = await chromium.launch({ headless: true })
    try {
      const context = await browser.newContext()
      const cookies = await fixtureCookieHeader(account(actor))
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
    const invitation = await invite('queued')
    const persisted = (
      await database!.query(
        'select token_hash,status,created_by from public.professional_invitations where id=$1',
        [invitation.id]
      )
    ).rows[0]
    expect(persisted.status).toBe('queued')
    expect(persisted.token_hash === invitation.token).toBe(false)
    expect(invitation.token.length).toBeGreaterThanOrEqual(43)
    expect(persisted.created_by).toBe(fixture.accounts.operations.profileId)
    const audit = (
      await database!.query(
        "select actor_profile_id,metadata from public.admin_audit_logs where entity_id=$1 and action='professional.invited'",
        [invitation.id]
      )
    ).rows[0]
    expect(audit.actor_profile_id).toBe(fixture.accounts.operations.profileId)
    expect(audit.metadata.reason).toBe('Convocatoria profesional')
    expect(
      (
        await fixture.accounts.operations.client
          .from('professional_invitations')
          .select('token_hash')
      ).error?.code
    ).toBe('42501')
  })
  it('allows only the verified provisioned recipient to consume an invitation idempotently', async () => {
    const invitation = await invite('applicant')
    expect((await request('/api/professional/onboarding/accept', 'customerB', 'POST', {
      token: invitation.token
    })).status).toBe(404)
    const accepted = await request('/api/professional/onboarding/accept', invitation.recipient, 'POST', {
      token: invitation.token
    })
    expect(accepted.status).toBe(200)
    const acceptedBody = await accepted.json()
    expect(acceptedBody.status).toBe('form_started')
    applicant = await hydrateRecipient(invitation.recipient)
    const repeated = await request('/api/professional/onboarding/accept', 'applicant', 'POST', {
      token: invitation.token
    })
    expect(repeated.status).toBe(200)
    expect(await repeated.json()).toEqual(acceptedBody)
    expect((await request('/api/professional/onboarding', 'applicant')).status).toBe(200)
    expect((await request('/api/jobs/final-report', 'applicant', 'POST', {})).status).toBe(403)
    expect((await request('/api/admin/professionals/approve', 'applicant', 'POST', {})).status).toBe(403)
  }, 120000)
  it('validates invitation matches without exposing its recipient or consuming it', async () => {
    const invitation = await invite('recipient-validation')
    const anonymous = createClient(
      process.env.LYSTO_TEST_SUPABASE_URL!, process.env.LYSTO_TEST_ANON_KEY!,
      { auth: { persistSession: false } }
    )
    expect((await anonymous.rpc('professional_invitation_matches', {
      p_token: invitation.token, p_email: invitation.recipient.email
    })).data).toBe(true)
    expect((await anonymous.rpc('professional_invitation_matches', {
      p_token: invitation.token, p_email: fixture.accounts.customerB.email
    })).data).toBe(false)
    expect((await request('/api/professional/onboarding/accept', 'customerA', 'POST', {
      token: invitation.token
    })).status).toBe(404)
    const confirmation = (await database!.query(
      'select email_confirmed_at from auth.users where id=$1', [invitation.recipient.authId]
    )).rows[0].email_confirmed_at
    try {
      await database!.query('update auth.users set email_confirmed_at=null where id=$1', [
        invitation.recipient.authId
      ])
      expect((await request('/api/professional/onboarding/accept', invitation.recipient, 'POST', {
        token: invitation.token
      })).status).toBe(403)
    } finally {
      await database!.query('update auth.users set email_confirmed_at=$1 where id=$2', [
        confirmation, invitation.recipient.authId
      ])
    }
    const row = (await database!.query(
      'select status,consumed_at from public.professional_invitations where id=$1',
      [invitation.id]
    )).rows[0]
    expect(row).toEqual({ status: 'queued', consumed_at: null })
    const landing = await fetch(new URL('/pro/onboarding/' + invitation.token, app!.baseURL), {
      redirect: 'manual'
    })
    expect(landing.status).toBe(200)
    expect(landing.headers.get('referrer-policy')).toBe('no-referrer')
    const html = await landing.text()
    expect(html.includes('Creá tu contraseña')).toBe(true)
    expect(/<button[^>]*type="submit"[^>]*>Continuar<\/button>/.test(html)).toBe(true)
  }, 120000)
  it('preprovisions verified Auth but creates the professional dossier only after acceptance', async () => {
    const invitation = await invite('bare-identity')
    const recipient = invitation.recipient
    const user = (await database!.query(
      'select id,email_confirmed_at,raw_app_meta_data from auth.users where id=$1',
      [recipient.authId]
    )).rows[0]
    expect(user.email_confirmed_at).not.toBeNull()
    expect(user.raw_app_meta_data?.app_role === 'professional' &&
      user.raw_app_meta_data?.signup_source === 'professional_invitation').toBe(true)
    expect((await database!.query('select id from public.profiles where auth_user_id=$1', [
      recipient.authId
    ])).rows).toHaveLength(0)
    const incorrectLogin = await fetch(new URL('/api/professional/onboarding/login', app!.baseURL), {
      method: 'POST',
      headers: { Origin: app!.baseURL, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: recipient.email, password: 'incorrect-credential' })
    })
    expect(incorrectLogin.status).toBe(401)
    const login = await fetch(new URL('/api/professional/onboarding/login', app!.baseURL), {
      method: 'POST',
      headers: { Origin: app!.baseURL, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: recipient.email, password: recipient.password })
    })
    expect(login.status).toBe(200)
    expect(login.headers.getSetCookie().some((value) => value.includes('-auth-token'))).toBe(true)
    expect((await database!.query('select id from public.profiles where auth_user_id=$1', [
      recipient.authId
    ])).rows).toHaveLength(0)
    const accepted = await request('/api/professional/onboarding/accept', recipient, 'POST', {
      token: invitation.token
    })
    expect(accepted.status).toBe(200)
    expect(accepted.headers.getSetCookie().some((value) => value.includes('-auth-token'))).toBe(true)
    const profile = (await database!.query(
      'select p.role,pp.status from public.profiles p join public.professional_profiles pp on pp.profile_id=p.id where p.auth_user_id=$1',
      [recipient.authId]
    )).rows[0]
    expect(profile).toEqual({ role: 'professional', status: 'form_started' })
    expect((await database!.query(
      'select * from private.customer_registration_acceptances where auth_user_id=$1',
      [recipient.authId]
    )).rows).toHaveLength(0)
  }, 120000)
  it('rejects invitation provisioning for an already-existing identity without rebinding it', async () => {
    const existing = fixture.accounts.customerA
    const response = await request('/api/admin/invite-professional', 'operations', 'POST', {
      firstName: 'No', lastName: 'Reasignar', email: existing.email,
      specialtySlug: 'aire_acondicionado'
    })
    expect(response.status).toBe(409)
    const role = (await database!.query(
      'select role from public.profiles where id=$1 and auth_user_id=$2',
      [existing.profileId, existing.authId]
    )).rows[0]
    expect(role.role).toBe('customer')
    expect((await database!.query(
      'select id from public.professional_invitations where email=$1 and created_by=$2 and provisioned_auth_user_id is not null',
      [existing.email, fixture.accounts.operations.profileId]
    )).rows).toHaveLength(0)
  })
  it('resumes Flow3 despite a past legacy date but rejects cancellation atomically', async () => {
    const resumable = await invite('resumable')
    await database!.query(
      "update public.professional_invitations set expires_at=now()-interval '1 minute' where id=$1",
      [resumable.id]
    )
    const document = (await database!.query(
      "select private.invitation_document_v2($1)->'expiresAt' as expires_at", [resumable.id]
    )).rows[0]
    expect(document.expires_at).toBeNull()
    // Flow3 resumes through the provisioned identity, not a legacy URL deadline.
    const resumed = await request('/api/professional/onboarding/accept', resumable.recipient, 'POST', {
      token: resumable.token
    })
    expect(resumed.status).toBe(200)
    expect((await resumed.json()).status).toBe('form_started')
    const cancelled = await invite('cancelled')
    expect((await request('/api/admin/invite-professional', 'finance', 'PATCH', {
      invitationId: cancelled.id, expectedVersion: cancelled.version,
      reason: 'Cancelación de una convocatoria incorrecta'
    })).status).toBe(403)
    const response = await request('/api/admin/invite-professional', 'operations', 'PATCH', {
      invitationId: cancelled.id, expectedVersion: cancelled.version,
      reason: 'Cancelación de una convocatoria incorrecta'
    })
    expect(response.status).toBe(200)
    expect((await response.json()).invitation.status).toBe('cancelled')
    expect((await request('/api/professional/onboarding/accept', cancelled.recipient, 'POST', {
      token: cancelled.token
    })).status).toBe(404)
    const event = (await database!.query(
      "select actor_profile_id,metadata from public.admin_audit_logs where entity_id=$1 and action='professional.invitation.cancelled'",
      [cancelled.id]
    )).rows[0]
    expect(event.actor_profile_id).toBe(fixture.accounts.operations.profileId)
    expect(event.metadata.from_status).toBe('queued')
    expect(event.metadata.to_status).toBe('cancelled')
  }, 120000)
  it('persists an owned application draft and detects concurrent edits without self approval', async () => {
    const current = await request('/api/professional/onboarding', 'applicant')
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
      licenseNumber: 'T11-MAT-001',
      licenseEntity: 'Entidad de prueba T11',
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
      'applicant',
      'POST',
      draft
    )
    expect(saved.status).toBe(200)
    const after = await saved.json()
    expect(after.version).toBeGreaterThan(before.version)
    expect(after.status).toBe('form_started')
    const reloaded = await request('/api/professional/onboarding', 'applicant')
    expect(await reloaded.json()).toMatchObject({
      firstName: 'Postulante',
      lastName: 'Prueba',
      tools: ['multimeter'],
      zoneIds: [zone],
      categoryIds: [category]
    })
    expect((await request('/api/mercadopago/account', 'applicant')).status).toBe(200)
    expect((await request('/api/mercadopago/account', 'customerA')).status).toBe(403)
    expect(
      (await request('/api/professional/onboarding', 'applicant', 'POST', draft)).status
    ).toBe(409)
    expect(
      (
        await request('/api/professional/onboarding', 'applicant', 'POST', {
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
      (await request('/api/professional/onboarding/context', 'applicant')).status
    ).toBe(200)
    await inBrowser('applicant', async (page) => {
      await page.goto(app!.baseURL + '/pro/onboarding')
      await page.getByRole('heading', { name: 'Mi postulación', exact: true }).waitFor()
      await page.locator('[role="progressbar"][aria-valuenow="1"]').waitFor()
      await page.getByRole('textbox', { name: 'Dirección', exact: true })
        .fill('Dirección de navegador 123, Buenos Aires')
      await page.getByRole('button', { name: 'Guardar y continuar', exact: true }).click()
      await page.locator('[role="progressbar"][aria-valuenow="2"]').waitFor()
      await page
        .getByRole('textbox', { name: 'Experiencia y presentación', exact: true })
        .fill('Borrador profesional persistido desde el navegador T11')
      await page.getByRole('button', { name: 'Guardar y continuar', exact: true }).click()
      await page.getByRole('status').filter({ hasText: 'Borrador guardado.' }).waitFor()
      await page.locator('[role="progressbar"][aria-valuenow="3"]').waitFor()
      expect(await page.getByRole('button', { name: 'Continuar a revisión', exact: true })
        .isDisabled()).toBe(true)
      expect(await page.getByRole('button', { name: 'Enviar postulación', exact: true })
        .count()).toBe(0)
      await page.reload()
      await page.locator('[role="progressbar"][aria-valuenow="3"]').waitFor()
      await page.getByRole('navigation', { name: 'Pasos de la postulación', exact: true })
        .getByRole('button', { name: /Actividad y disponibilidad/ }).click()
      await page.locator('[role="progressbar"][aria-valuenow="2"]').waitFor()
      expect(
        await page
          .getByRole('textbox', { name: 'Experiencia y presentación', exact: true })
          .inputValue()
      ).toBe('Borrador profesional persistido desde el navegador T11')
      expect(await page.getByRole('textbox', { name: 'Número de matrícula', exact: true })
        .inputValue()).toBe('T11-MAT-001')
      expect(await page.getByLabel('Desde 1', { exact: true }).inputValue()).toBe('09:00')
    })
    const persisted = await (await request('/api/professional/onboarding', 'applicant')).json()
    expect(persisted.bio).toBe('Borrador profesional persistido desde el navegador T11')
    expect(persisted.address).toBe('Dirección de navegador 123, Buenos Aires')
  }, 120000)
  it('paginates actual invitations and professionals and keeps administrative dossiers private', async () => {
    expect((await request('/api/admin/professionals', 'quality')).status).toBe(403)
    const first = await (
      await request('/api/admin/professionals/invitations?pageSize=1', 'operations')
    ).json()
    expect(first.items).toHaveLength(1)
    expect(first.nextCursor).toBeTruthy()
    expect(JSON.stringify(first).includes('token')).toBe(false)
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
        (item: { id: string }) => item.id === applicant.entityId
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
      entityId: applicant.entityId,
      documentType: 'identity_front',
      mimeType: 'image/png',
      sizeBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex')
    }
    expect(
      (await request('/api/uploads/sign', 'applicant', 'POST', declaration)).status
    ).toBe(403)
    expect(
      (
        await request(
          '/api/professional/onboarding/documents/sign',
          'applicant',
          'POST',
          { ...declaration, kind: 'job-document' }
        )
      ).status
    ).toBe(400)
    const signedResponse = await request(
      '/api/professional/onboarding/documents/sign',
      'applicant',
      'POST',
      declaration
    )
    expect(signedResponse.status).toBe(200)
    const signed = await signedResponse.json()
    expect(
      (
        await applicant.client.storage
          .from(signed.bucket)
          .uploadToSignedUrl(signed.path, signed.token, bytes, {
            contentType: 'image/png',
            upsert: false
          })
      ).error
    ).toBeNull()
    const verified = await request(
      '/api/professional/onboarding/documents/finalize',
      'applicant',
      'POST',
      { intentId: signed.intentId }
    )
    expect(verified.status).toBe(200)
    expect((await verified.json()).status).toBe('verified')
    const read = await request(
      '/api/professional/onboarding/documents/read',
      'applicant',
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
    await uploadDocument('identity_back')
    await uploadDocument('license')
  }, 180000)
  it('saves a verified avatar and owned address required by the Flow3 dossier', async () => {
    const before = await (await request('/api/professional/onboarding', 'applicant')).json()
    const address = await request('/api/professional/onboarding/address', 'applicant', 'POST', {
      address: 'Dirección sintética 123, Buenos Aires', expectedVersion: before.version
    })
    expect(address.status).toBe(200)
    expect((await address.json()).address).toBe('Dirección sintética 123, Buenos Aires')
    const bytes = await sharp({
      create: { width: 24, height: 24, channels: 3, background: '#456789' }
    }).png().toBuffer()
    const avatar = await fetch(new URL('/api/professional/onboarding/avatar', app!.baseURL), {
      method: 'POST',
      headers: {
        Origin: app!.baseURL, Cookie: await fixtureCookieHeader(applicant),
        'Content-Type': 'image/png'
      },
      body: new Uint8Array(bytes), signal: AbortSignal.timeout(90000)
    })
    expect(avatar.status).toBe(200)
    const result = await avatar.json()
    expect(new URL(result.avatarUrl).origin).toBe(new URL(process.env.LYSTO_TEST_SUPABASE_URL!).origin)
    expect((await database!.query(
      'select professional_id from private.professional_avatars where professional_id=$1',
      [applicant.entityId]
    )).rows).toHaveLength(1)
  }, 120000)
  it('keeps submission closed without current review or legal policy and denies direct approval', async () => {
    const before = await (await request('/api/professional/onboarding', 'applicant')).json()
    const category = (await database!.query(
      'select category_id from public.professional_service_categories where professional_id=$1 order by category_id limit 1',
      [applicant.entityId]
    )).rows[0].category_id
    const currentPolicy = (await database!.query(
      'select * from private.professional_review_policies where category_id=$1', [category]
    )).rows[0]
    const body = {
      expectedVersion: before.version, accepted: true,
      termsVersion: 'missing-policy', privacyVersion: 'missing-policy'
    }
    try {
      await database!.query('delete from private.professional_review_policies where category_id=$1', [category])
      expect((await request('/api/professional/onboarding/submit', 'applicant', 'POST', body)).status).toBe(503)
    } finally {
      if (currentPolicy)
        await database!.query(
          'insert into private.professional_review_policies select (jsonb_populate_record(null::private.professional_review_policies,$1::jsonb)).*',
          [JSON.stringify(currentPolicy)]
        )
    }
    const legal = (await database!.query(
      'select enabled from private.account_registration_policy where singleton'
    )).rows[0]
    const temporaryPolicyVersion = 't11-legal-check-' + fixture.accounts.owner.profileId
    try {
      // On clean CI, categories are seeded after the baseline migration. Supply
      // a bounded test-only policy solely to reach the separate legal guard.
      if (!currentPolicy)
        await database!.query(
          "insert into private.professional_review_policies(category_id,version,required_documents,expiry_documents,required_tools,min_experience,requires_license,test_only) values($1,$2,array['identity_front','identity_back','license'],'{}','{}',0,true,true)",
          [category, temporaryPolicyVersion]
        )
      await database!.query('update private.account_registration_policy set enabled=false where singleton')
      expect((await request('/api/professional/onboarding/submit', 'applicant', 'POST', body)).status).toBe(503)
    } finally {
      try {
        await database!.query('update private.account_registration_policy set enabled=$1 where singleton', [legal.enabled])
      } finally {
        if (!currentPolicy)
          await database!.query(
            'delete from private.professional_review_policies where category_id=$1 and version=$2',
            [category, temporaryPolicyVersion]
          )
      }
    }
    const restoredPolicy = (await database!.query(
      'select * from private.professional_review_policies where category_id=$1', [category]
    )).rows[0]
    expect(Boolean(restoredPolicy)).toBe(Boolean(currentPolicy))
    if (currentPolicy)
      expect(JSON.stringify(restoredPolicy) === JSON.stringify(currentPolicy)).toBe(true)
    expect((await (await request('/api/professional/onboarding', 'applicant')).json()).status).toBe('form_started')
    expect((await fixture.accounts.operations.client.from('professional_profiles')
      .update({ status: 'approved' }).eq('id', applicant.entityId)).error?.code).toBe('42501')
  })
  it('requires actual documents, explicit acceptance and attributed review before atomic approval', async () => {
    const professionalId = applicant.entityId
    policyVersion = 't11-' + fixture.accounts.owner.profileId
    oldPolicy = (
      await database!.query('select * from private.account_registration_policy where singleton')
    ).rows[0]
    const category = (
      await database!.query(
        "select id from public.service_categories where slug='aire_acondicionado'"
      )
    ).rows[0].id
    reviewCategoryId = category
    oldReviewPolicy = (await database!.query(
      'select * from private.professional_review_policies where category_id=$1', [category]
    )).rows[0]
    await database!.query(
      "insert into private.professional_review_policies(category_id,version,required_documents,expiry_documents,required_tools,min_experience,requires_license,approved_at,test_only) values($1,$2,array['identity_front','identity_back','license','insurance'],array['identity_front'],array['multimeter'],1,true,null,true) on conflict(category_id) do update set version=excluded.version,required_documents=excluded.required_documents,expiry_documents=excluded.expiry_documents,required_tools=excluded.required_tools,min_experience=excluded.min_experience,requires_license=excluded.requires_license,approved_at=null,test_only=true",
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
      await request('/api/professional/onboarding', 'applicant')
    ).json()
    const submission = {
      expectedVersion: initial.version,
      accepted: true,
      termsVersion: policyVersion + '-terms',
      privacyVersion: policyVersion + '-privacy'
    }
    expect(
      (
        await request('/api/professional/onboarding/submit', 'applicant', 'POST', {
          ...submission,
          accepted: false
        })
      ).status
    ).toBe(400)
    expect(
      (
        await request(
          '/api/professional/onboarding/submit',
          'applicant',
          'POST',
          submission
        )
      ).status
    ).toBe(400)
    // Satisfy the unchanged policy with actual inspected evidence.
    await uploadDocument('insurance')
    submission.expectedVersion = (await (await request('/api/professional/onboarding', 'applicant')).json()).version
    const submittedResponse = await request(
      '/api/professional/onboarding/submit',
      'applicant',
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
      (await request('/api/jobs/final-report', 'applicant', 'POST', {})).status
    ).toBe(403)
    const fields = Object.fromEntries(
      Object.entries(returnedBody.application).filter(
        ([key]) => !['professionalId', 'email', 'version', 'status', 'address'].includes(key)
      )
    )
    const correction = await request(
      '/api/professional/onboarding',
      'applicant',
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
      'applicant',
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
    expect((await request('/api/admin/professionals/approve', 'operations', 'POST', {
      professionalId, expectedVersion: submitted.version,
      reason: 'Intento previo a la revisión documental'
    })).status).toBe(409)
    let reviewed = review
    expect(review.documents.map((item: { documentType: string }) => item.documentType))
      .toEqual(expect.arrayContaining(['identity_front', 'identity_back', 'license', 'insurance']))
    for (const documentType of ['identity_front', 'identity_back', 'license', 'insurance']) {
      const document = reviewed.documents.find(
        (item: { documentType: string }) => item.documentType === documentType
      )
      expect(document.status).toBe('pending')
      const decision = {
        professionalId, documentId: document.id,
        expectedVersion: reviewed.application.version,
        decision: 'approved',
        reason: 'Revisión humana simulada exclusivamente para este ensayo',
        expiresAt: null as string | null
      }
      if (documentType === 'identity_front') {
        expect((await request(
          '/api/admin/professionals/documents/review', 'operations', 'POST', decision
        )).status).toBe(400)
        decision.expiresAt = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10)
      }
      const reviewedResponse = await request(
        '/api/admin/professionals/documents/review', 'operations', 'POST', decision
      )
      expect(reviewedResponse.status).toBe(200)
      reviewed = await reviewedResponse.json()
      expect(reviewed.application.status).toBe('under_review')
      expect(reviewed.documents.find((item: { id: string }) => item.id === document.id).reviewedBy)
        .toBe(fixture.accounts.operations.profileId)
    }
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
      await page.getByText('Aprobado · Documentación vigente · No recibe trabajos nuevos', {
        exact: true
      }).waitFor()
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
    expect(readiness.rows[0].reasons).toEqual(expect.arrayContaining(['mercado_pago']))
    expect(readiness.rows[0].reasons).not.toContain('foto')
    expect(
      (await request('/api/jobs/final-report', 'applicant', 'POST', {})).status
    ).toBe(400)
  }, 120000)
  it('withdraws operational authority when required evidence expires while preserving the application', async () => {
    const professionalId = applicant.entityId
    const document = (
      await database!.query(
        "select id,expires_at::text from public.professional_documents where professional_id=$1 and document_type='identity_front'",
        [professionalId]
      )
    ).rows[0]
    try {
      await database!.query(
        "update public.professional_documents set expires_at='2000-01-01' where id=$1",
        [document.id]
      )
      expect(
        (await request('/api/jobs/final-report', 'applicant', 'POST', {})).status
      ).toBe(403)
      const context = await applicant.client.rpc('get_session_context')
      expect(context.data.professional_eligible).toBe(false)
      expect((await request('/api/professional/onboarding', 'applicant')).status).toBe(
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
      (await request('/api/jobs/final-report', 'applicant', 'POST', {})).status
    ).toBe(400)
  })
})
