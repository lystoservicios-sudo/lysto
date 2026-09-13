import { test, expect, loginAs } from './fixtures/production'

test('customer saves a quote through the current flow and reloads its persistent identifier', async ({
  page,
  accounts
}) => {
  await loginAs(page, accounts.accounts.customerA, 'customerA')
  await page.goto('/app/solicitar/aire-acondicionado')
  await page.getByRole('radio', { name: /No enfría/ }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('radio', { name: /Hace días/ }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('heading', { name: 'El aire no enfría' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Calle').fill('Synthetic')
  await page.getByLabel('Número').fill('123')
  await page.getByLabel('Ciudad').fill('CABA')
  await page.getByLabel('Provincia').fill('CABA')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Calcular traslado y guardar presupuesto' }).click()
  await expect(page.getByRole('status')).toContainText('Presupuesto guardado')
  await page.goto('/app/presupuestos')
  await expect(page.locator('[data-quote-id]').first()).toBeVisible()
  await page.reload()
  await expect(page.locator('[data-quote-id]').first()).toBeVisible()
})

test('double click is bounded while a quote is being persisted', async ({ page, accounts }) => {
  await loginAs(page, accounts.accounts.customerB, 'customerB')
  const responses = await Promise.all([
    page.request.post('/api/diagnosis/generate', {
      headers: { origin: new URL(page.url()).origin },
      data: { issue: 'mantenimiento', timeSince: 'months' }
    }),
    page.request.post('/api/diagnosis/generate', {
      headers: { origin: new URL(page.url()).origin },
      data: { issue: 'mantenimiento', timeSince: 'months' }
    })
  ])
  const statuses = responses.map((response) => response.status())
  expect(statuses).toContain(200)
  expect(statuses.every((status) => status === 200 || status === 429)).toBe(true)
})
