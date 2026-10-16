import { randomBytes, randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { test as productionTest, expect, loginAs } from './fixtures/production'
import { createFixtureAccounts } from '../integration/fixtures'
import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'

// These journeys own their worker accounts rather than inheriting the login
// budget consumed by customer suites. Keep real MFA and scoped cleanup intact.
const test = productionTest.extend({
  accounts: [
    async ({}, use) => {
      const pending = createFixtureAccounts({ directSqlAuth: process.env.APP_ENV === 'staging' })
      try {
        await use(await pending)
      } finally {
        await pending.cleanup()
      }
    },
    { scope: 'worker' }
  ]
})

test('an invalid Flow3 invitation cannot claim or convert a customer identity', async ({
  page,
  accounts
}) => {
  test.setTimeout(60_000)
  const token = randomBytes(32).toString('base64url')
  const target = assertTestEnvironment(process.env, readTestIdentity(process.env))
  const db = new Client({
    connectionString: target.databaseUrl,
    connectionTimeoutMillis: 5000, query_timeout: 10000
  })
  await db.connect()
  try {
    const identitySql = `select p.role,u.raw_app_meta_data->>'app_role' trusted_role,
      (select count(*)::integer from public.professional_profiles pp where pp.profile_id=p.id) professional_count
      from public.profiles p join auth.users u on u.id=p.auth_user_id
      where p.id=$1 and p.auth_user_id=$2`
    const customer = accounts.accounts.customerA
    const identityParams = [customer.profileId, customer.authId]
    const before = (await db.query(identitySql, identityParams)).rows
    expect(before).toEqual([{ role: 'customer', trusted_role: 'customer', professional_count: 0 }])
    // Flow3 accepts an existing verified identity. The old password-registration
    // endpoint is not a substitute for its canonical token/recipient denial.
    const landing = await page.goto(`/pro/onboarding/${token}`)
    expect(landing?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Ingresá para comenzar', exact: true })).toBeVisible()
    await expect(page.getByLabel('Correo electrónico', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Contraseña provisoria o actual', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ingresar y continuar', exact: true })).toBeVisible()
    const headers = { Origin: new URL(page.url()).origin }
    const anonymous = await page.request.post('/api/professional/onboarding/accept', {
      headers, data: { token }
    })
    expect(anonymous.status()).toBe(401)
    expect((await anonymous.json()).code === 'unauthorized').toBe(true)
    await loginAs(page, customer, 'customerA')
    const unavailable = await page.request.post('/api/professional/onboarding/accept', {
      headers, data: { token }
    })
    expect(unavailable.status()).toBe(404)
    expect((await unavailable.json()).code === 'not_found').toBe(true)
    const after = (await db.query(identitySql, identityParams)).rows
    expect(after).toEqual(before)
    await page.goto('/app')
    await expect(page.getByRole('heading', { name: '¿Qué necesitás?' })).toBeVisible()
    expect(new URL(page.url()).pathname === '/app').toBe(true)
  } finally {
    await db.end()
  }
})

test('administration provisions an invited identity without exposing credentials or a link', async ({
  page,
  accounts
}) => {
  test.setTimeout(90_000)
  const email = `invited.${randomUUID()}@lysto.test`
  const target = assertTestEnvironment(process.env, readTestIdentity(process.env))
  const db = new Client({
    connectionString: target.databaseUrl,
    connectionTimeoutMillis: 5000, query_timeout: 10000
  })
  const serviceKey = process.env.LYSTO_TEST_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('Disposable Auth cleanup is unavailable')
  const admin = createClient(target.apiUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, {
      ...init, redirect: 'error', signal: AbortSignal.timeout(15000)
    }) }
  })
  await db.connect()
  try {
    await loginAs(page, accounts.accounts.owner, 'owner')
    await page.goto('/admin/profesionales/invitaciones')
    await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Profesional')
    await page.getByRole('textbox', { name: 'Apellido', exact: true }).fill('Prueba')
    await page.getByRole('textbox', { name: 'Correo', exact: true }).fill(email)
    const specialty = page.getByRole('combobox', { name: 'Especialidad', exact: true })
    const firstSpecialty = await specialty.locator('option').nth(1).getAttribute('value')
    if (!firstSpecialty) throw new Error('No active specialty is available for the invitation')
    await specialty.selectOption(firstSpecialty)
    const provisionResponse = page.waitForResponse((response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/admin/invite-professional'
    )
    await page.getByRole('button', { name: 'Crear invitación', exact: true }).click()
    const provisioned = await provisionResponse
    expect(provisioned.status()).toBe(201)
    const result = await provisioned.json()
    for (const field of ['link', 'token', 'password', 'temporaryPassword', 'invitationToken', 'invitation_token']) {
      expect(Object.hasOwn(result, field)).toBe(false)
      expect(Object.hasOwn(result.invitation, field)).toBe(false)
    }
    expect(result.invitation.status === 'queued' && result.invitation.expiresAt === null).toBe(true)
    expect(result.delivery?.accepted === false && result.delivery?.reason === 'email_not_configured').toBe(true)
    // Next's route announcer also exposes role=alert. Keep all business alerts
    // in scope so an unrelated error cannot be hidden by selecting the first.
    const invitationAlerts = page.getByRole('alert').and(
      page.locator(':not(#__next-route-announcer__)')
    )
    await expect(invitationAlerts).toHaveCount(1)
    await expect(invitationAlerts).toHaveText(
      'El correo no está configurado. La invitación quedó pendiente; configurá el envío y reenviá desde su expediente.'
    )
    await expect(page.getByRole('link', { name: 'Abrir enlace de invitación', exact: true })).toHaveCount(0)
    await expect(page.locator('a[href*="/pro/onboarding/"]')).toHaveCount(0)
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
    const identity = (await db.query(
      "select i.id,i.status,i.flow_version,i.provisioned_auth_user_id,u.email_confirmed_at,u.raw_app_meta_data->>'app_role' app_role,u.raw_app_meta_data->>'signup_source' signup_source from public.professional_invitations i join auth.users u on u.id=i.provisioned_auth_user_id and u.email=$1 where i.email=$1 and i.created_by=$2",
      [email, accounts.accounts.owner.profileId]
    )).rows
    expect(identity.length).toBe(1)
    expect(identity[0].status === 'queued' && identity[0].flow_version === 3).toBe(true)
    expect(identity[0].provisioned_auth_user_id !== null && identity[0].email_confirmed_at !== null).toBe(true)
    expect(identity[0].app_role === 'professional' && identity[0].signup_source === 'professional_invitation').toBe(true)
    expect((await db.query('select id from public.profiles where auth_user_id=$1', [
      identity[0].provisioned_auth_user_id
    ])).rows.length).toBe(0)
    expect((await db.query(
      "select id from private.outbox_events where aggregate_id=$1 and event_type='professional.invited'",
      [identity[0].id]
    )).rows.length).toBe(0)
    await page.reload()
    await expect(page.getByRole('link', { name: 'Abrir enlace de invitación', exact: true })).toHaveCount(0)
    await page.goto('/admin/profesionales')
    const invitedRow = page.getByRole('row').filter({ hasText: email })
    await expect(invitedRow).toContainText('Profesional Prueba')
    await expect(invitedRow).toContainText('Invitado')
    await expect(invitedRow).toContainText('Registro sin completar')
    await expect(invitedRow).toContainText('No puede recibir')
    const profileLink = invitedRow.getByRole('link', { name: 'Ver perfil', exact: true })
    const profilePath = await profileLink.getAttribute('href')
    expect(profilePath).toMatch(/^\/admin\/profesionales\/[a-f0-9-]{36}$/)
    // Wait for the actual navigation before asserting data on the next screen.
    // Keep the content assertions and the global timeouts unchanged.
    await Promise.all([
      page.waitForURL(new URL(profilePath!, page.url()).href, { timeout: 15_000 }),
      profileLink.click()
    ])
    await expect(page.getByText('Invitación pendiente de envío', { exact: true })).toBeVisible()
    await expect(page.getByText('El acceso no vence. Puede retomar el registro iniciando sesión.', {
      exact: true
    })).toBeVisible()
  } finally {
    try {
      const invitations = await db.query<{
        id: string; provisioned_auth_user_id: string | null; auth_email: string | null; signup_source: string | null
      }>(
        "select i.id,i.provisioned_auth_user_id,u.email auth_email,u.raw_app_meta_data->>'signup_source' signup_source from public.professional_invitations i left join auth.users u on u.id=i.provisioned_auth_user_id where i.email=$1 and i.created_by=$2",
        [email, accounts.accounts.owner.profileId]
      )
      for (const row of invitations.rows) {
        if (row.provisioned_auth_user_id &&
          (row.auth_email !== email || row.signup_source !== 'professional_invitation'))
          throw new Error('Synthetic invitation Auth cleanup scope mismatch')
        const domain = row.provisioned_auth_user_id
          ? (await db.query(
            'select p.id profile_id,pro.id professional_id from public.profiles p left join public.professional_profiles pro on pro.profile_id=p.id where p.auth_user_id=$1',
            [row.provisioned_auth_user_id]
          )).rows : []
        const profiles = domain.map((item) => item.profile_id)
        const entities = [row.id, ...domain.map((item) => item.professional_id).filter(Boolean)]
        await db.query(
          'delete from private.outbox_events where aggregate_id=any($1::uuid[]) or recipient_profile_id=any($2::uuid[])',
          [entities, profiles]
        )
        await db.query(
          'delete from public.admin_audit_logs where entity_id=any($1::uuid[]) or actor_profile_id=any($2::uuid[])',
          [entities, profiles]
        )
        await db.query('delete from public.professional_profiles where invitation_id=$1', [row.id])
        await db.query(
          'delete from public.professional_invitations where id=$1 and email=$2 and created_by=$3',
          [row.id, email, accounts.accounts.owner.profileId]
        )
        // The invitation's provisioned identity FK must be removed before Auth.
        if (row.provisioned_auth_user_id) {
          let deleted = false
          for (let attempt = 0; attempt < 3 && !deleted; attempt++)
            deleted = !(await admin.auth.admin.deleteUser(row.provisioned_auth_user_id)).error
          if (!deleted) throw new Error('Synthetic invited Auth cleanup failed')
        }
      }
    } finally {
      await db.end()
    }
  }
})

test('approved professional completes MFA and reloads the live workspace', async ({
  page,
  accounts
}) => {
  await loginAs(page, accounts.accounts.professionalApproved, 'professionalApproved')
  await expect(page.getByRole('heading', { name: /Hola, professionalApproved/i })).toBeVisible()
  await page.goto('/pro/trabajos')
  await expect(page.getByRole('heading', { name: 'Mis trabajos' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'No hay trabajos en este estado' }).last()).toBeVisible()
  expect((await page.goto('/app'))?.status()).toBe(404)
})
