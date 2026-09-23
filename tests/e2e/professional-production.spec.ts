import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { test, expect, loginAs } from './fixtures/production'

test('an anonymous visitor cannot consume a professional invitation', async ({ page }) => {
  await page.goto(`/pro/onboarding/${'a'.repeat(43)}`)
  await expect(page.getByRole('heading', { name: 'Tu invitación profesional' })).toBeVisible()
  await page.getByRole('button', { name: 'Aceptar invitación' }).click()
  await expect(page.getByText('Tu sesión terminó. Volvé a iniciar sesión.')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/pro/onboarding/${'a'.repeat(43)}$`))
})

test('administration reveals a new invitation link once and another email cannot consume it', async ({
  page,
  accounts
}) => {
  test.setTimeout(90_000)
  const email = `invited.${randomUUID()}@lysto.test`
  const db = new Client({ connectionString: process.env.LYSTO_TEST_DATABASE_URL })
  await db.connect()
  try {
    await loginAs(page, accounts.accounts.owner, 'owner')
    await page.goto('/admin/profesionales/invitaciones')
    await page.getByRole('textbox', { name: 'Correo del profesional' }).fill(email)
    const specialty = page.getByRole('combobox', { name: 'Especialidad' })
    const firstSpecialty = await specialty.locator('option').nth(1).getAttribute('value')
    if (!firstSpecialty) throw new Error('No active specialty is available for the invitation')
    await specialty.selectOption(firstSpecialty)
    await page.getByRole('textbox', { name: 'Motivo de la convocatoria' }).fill('Verificación automatizada del enlace individual')
    await page.getByRole('button', { name: 'Crear invitación' }).click()

    const link = page.getByRole('link', { name: 'Abrir enlace de invitación' })
    await expect(link).toBeVisible()
    const href = await link.getAttribute('href')
    expect(href).toBeTruthy()
    const invitationUrl = new URL(href!)
    expect(invitationUrl.origin).toBe(new URL(page.url()).origin)
    expect(invitationUrl.pathname).toMatch(/^\/pro\/onboarding\/[A-Za-z0-9_-]{43}$/)
    expect(invitationUrl.search).toBe('')
    expect(invitationUrl.hash).toBe('')
    await expect(page.getByText(email, { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('link', { name: 'Abrir enlace de invitación' })).toHaveCount(0)
    await expect(page.getByText(email, { exact: true })).toBeVisible()

    await page.context().clearCookies({ name: /^sb-/ })
    await loginAs(page, accounts.accounts.customerB, 'customerB')
    await page.goto(href!)
    await expect(page.getByRole('heading', { name: 'Tu invitación profesional' })).toBeVisible()
    await page.getByRole('button', { name: 'Aceptar invitación' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    const role = await db.query<{ role: string }>(
      'select role from public.profiles where id=$1',
      [accounts.accounts.customerB.profileId]
    )
    expect(role.rows[0]?.role).toBe('customer')
  } finally {
    const invitation = await db.query<{ id: string }>(
      'select id from public.professional_invitations where email=$1 and created_by=$2',
      [email, accounts.accounts.owner.profileId]
    )
    for (const row of invitation.rows) {
      await db.query('delete from private.outbox_events where aggregate_id=$1', [row.id])
      await db.query('delete from public.admin_audit_logs where entity_id=$1', [row.id])
      await db.query('delete from public.professional_profiles where invitation_id=$1', [row.id])
      await db.query('delete from public.professional_invitations where id=$1', [row.id])
    }
    await db.end()
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
