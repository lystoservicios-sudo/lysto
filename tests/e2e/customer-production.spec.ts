import { test, expect, loginAs } from './fixtures/production'

test('customer reloads the live dashboard and empty request history', async ({
  page,
  accounts
}) => {
  await loginAs(page, accounts.accounts.customerA, 'customerA')
  await expect(page.getByRole('heading', { name: /Hola, CustomerA/ })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Tu hogar todavía no tiene actividad')).toBeVisible()
  await page.goto('/app/solicitudes')
  await expect(page.getByRole('heading', { name: 'Mis solicitudes' })).toBeVisible()
  await expect(page.getByText('Todavía no tenés solicitudes')).toBeVisible()
})

test('a customer cannot load another customer identifier', async ({ page, accounts }) => {
  await loginAs(page, accounts.accounts.customerA, 'customerA')
  expect((await page.goto(`/app/equipos/${accounts.accounts.customerB.entityId}`))?.status()).toBe(
    404
  )
})
