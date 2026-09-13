import { test, expect, loginAs } from './fixtures/production'

test('customer reloads the live dashboard and empty request history', async ({
  page,
  accounts
}) => {
  await loginAs(page, accounts.accounts.customerA, 'customerA')
  await expect(page.getByRole('heading', { name: /Hola, customerA/i })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Tu hogar todavía no tiene actividad')).toBeVisible()
  await page.goto('/app/solicitudes')
  await expect(page.getByRole('heading', { name: 'Mis solicitudes' })).toBeVisible()
  await expect(page.getByText('Todavía no tenés solicitudes')).toBeVisible()
})

test('a customer cannot load another customer identifier', async ({ page, accounts }) => {
  await loginAs(page, accounts.accounts.customerA, 'customerA')
  await page.goto(`/app/equipos/${accounts.accounts.customerB.entityId}`)
  await expect(page.getByRole('heading', { name: 'No encontramos ese equipo' })).toBeVisible()
})
