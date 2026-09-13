import { test, expect, loginAs } from './fixtures/production'

test('operations sees its real queue and cannot discover finance tools', async ({
  page,
  accounts
}) => {
  await loginAs(page, accounts.accounts.operations, 'operations')
  await expect(page.getByRole('heading', { name: 'Operaciones' })).toBeVisible()
  await page.getByRole('button', { name: /Todas las herramientas/ }).click()
  const tools = page.getByRole('navigation', { name: 'Todas las herramientas de administración' })
  await expect(tools.getByRole('link', { name: 'Solicitudes' })).toBeVisible()
  await expect(tools.getByRole('link', { name: 'Pagos' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByText(/Consola operativa/)).toBeVisible()
})

test('quality lands on cases and direct finance data stays forbidden', async ({
  page,
  accounts
}) => {
  await loginAs(page, accounts.accounts.quality, 'quality')
  await expect(page).toHaveURL(/\/admin\/calidad/)
  const response = await page.request.get('/api/mercadopago/checkouts')
  expect(response.status()).toBe(403)
})
