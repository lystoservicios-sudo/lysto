import { test, expect, loginAs } from './fixtures/production'

test('finance lands on the canonical payment module without operations access', async ({
  page,
  accounts
}) => {
  await loginAs(page, accounts.accounts.finance, 'finance')
  await expect(page.getByRole('heading', { name: 'Pagos con Mercado Pago' })).toBeVisible()
  await page.goto('/admin/pagos/split')
  await expect(page.getByRole('heading', { name: 'Pagos con Mercado Pago' })).toBeVisible()
  await expect(page.getByText(/Cargando excepciones|No hay/).first()).toBeVisible()
  const queue = await page.request.get('/admin/dashboard')
  expect(queue.status()).toBe(200)
  expect(queue.url()).toContain('/admin/pagos')
})
