import { test, expect, loginAs, loginCredentialsForm } from './fixtures/production'

test('three roles keep independent sessions and reject foreign surfaces', async ({
  page,
  accounts
}) => {
  await loginAs(page, accounts.accounts.customerA, 'customerA')
  expect((await page.goto('/admin/dashboard'))?.status()).toBe(404)
  expect((await page.goto('/pro/dashboard'))?.status()).toBe(404)
})

test('a suspended professional cannot create an application session', async ({
  page,
  accounts
}) => {
  const account = accounts.accounts.professionalSuspended
  await page.goto('/equipo/login')
  const form = loginCredentialsForm(page)
  await form.getByLabel('Email').fill(account.email)
  await form.getByLabel('Contraseña').fill(account.password)
  await form.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByText('Tu perfil técnico todavía no está aprobado por Lysto.')).toBeVisible()
  await expect(page).toHaveURL(/\/equipo\/login/)
})
