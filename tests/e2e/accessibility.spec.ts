import { test, expect, loginCredentialsForm } from './fixtures/production'

test('public navigation and policy links work with keyboard focus', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Información legal' })).toBeVisible()
  const privacy = page.getByRole('link', { name: 'Privacidad' })
  await privacy.focus()
  await expect(privacy).toBeFocused()
  await privacy.click()
  await expect(page.getByRole('heading', { name: 'Privacidad' })).toBeVisible()
})

test('mobile pages do not overflow and primary targets meet minimum height', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/login')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(overflow).toBe(false)
  const button = page.getByRole('button', { name: 'Ingresar' })
  await expect(button).toBeVisible()
  expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  await expect(loginCredentialsForm(page).getByLabel('Email')).toHaveAttribute('type', 'email')
  await expect(loginCredentialsForm(page).getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'password')
  await expect(page.getByRole('button', { name: 'Mostrar contraseña', exact: true })).toBeVisible()
  let submissions = 0
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/login') submissions++
  })
  const form = loginCredentialsForm(page)
  await form.getByLabel('Email', { exact: true }).fill('native-validation@example.com')
  const password = form.getByLabel('Contraseña', { exact: true })
  await password.fill('')
  await button.click()
  // A first tap must activate native required-field validation, not be lost
  // when the focused input blurs and the header changes geometry.
  await expect(password).toBeFocused()
  expect(submissions).toBe(0)
})
