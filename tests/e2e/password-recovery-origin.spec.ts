import { test, expect } from '@playwright/test'

test('recovery form preserves its origin and reaches token validation', async ({ page }) => {
  const preview = await page.goto(`/restablecer?token_hash=${'a'.repeat(64)}`)
  expect(preview?.headers()['referrer-policy']).toBe('same-origin')
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('Prueba123')
  // A synthetic token cannot authorize a password change for a real account.
  await page.getByLabel('Repetir contraseña', { exact: true }).fill('Prueba123')
  const submitted = page.waitForRequest(request =>
    request.method() === 'POST' && new URL(request.url()).pathname === '/auth/reset-password'
  )
  const result = page.waitForResponse(response =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/auth/reset-password'
  )
  await page.getByRole('button', { name: 'Guardar contraseña', exact: true }).click()
  // Chromium's synchronous headers omit network-added headers on fetch requests.
  expect((await (await submitted).allHeaders()).origin).toBe(new URL(page.url()).origin)
  expect((await result).status()).toBe(400)
  await expect(page.getByText('El enlace venció o ya fue utilizado.', { exact: false })).toBeVisible()
  await expect(page.getByText('Origen no permitido.', { exact: true })).toHaveCount(0)
})
