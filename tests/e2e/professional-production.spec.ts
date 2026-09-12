import { test, expect, loginAs } from './fixtures/production'

test('approved professional completes MFA and reloads the live workspace', async ({
  page,
  accounts
}) => {
  await loginAs(page, accounts.accounts.professionalApproved, 'professionalApproved')
  await expect(page.getByRole('heading', { name: /Hola, ProfessionalApproved/ })).toBeVisible()
  await page.goto('/pro/trabajos')
  await expect(page.getByRole('heading', { name: 'Mis trabajos' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('No hay trabajos en este estado')).toBeVisible()
  expect((await page.goto('/app'))?.status()).toBe(404)
})
