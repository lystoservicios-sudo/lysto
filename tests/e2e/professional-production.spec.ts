import { test, expect, loginAs } from './fixtures/production'

test('an anonymous visitor cannot consume a professional invitation', async ({ page }) => {
  await page.goto(`/pro/onboarding/${'a'.repeat(43)}`)
  await expect(page.getByRole('heading', { name: 'Tu invitación profesional' })).toBeVisible()
  await page.getByRole('button', { name: 'Aceptar invitación' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/pro/onboarding/${'a'.repeat(43)}$`))
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
