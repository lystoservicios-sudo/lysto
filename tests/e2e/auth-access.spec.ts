import { test, expect, loginAs } from './fixtures/production'

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
  await page.goto('/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Contraseña').fill(account.password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('alert')).toContainText('todavía no está aprobado')
  await expect(page).toHaveURL(/\/login/)
})
