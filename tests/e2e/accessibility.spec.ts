import { test, expect } from './fixtures/production'

test('public navigation and policy links work with keyboard focus', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  const focused = page.locator(':focus')
  await expect(focused).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Información legal' })).toBeVisible()
  await page.getByRole('link', { name: 'Privacidad' }).click()
  await expect(page.getByRole('heading', { name: 'Privacidad' })).toBeVisible()
})

test('mobile pages do not overflow and primary targets meet minimum height', async ({ page }) => {
  await page.goto('/login')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(overflow).toBe(false)
  const button = page.getByRole('button', { name: 'Ingresar' })
  await expect(button).toBeVisible()
  expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  await expect(page.getByLabel('Email')).toHaveAttribute('type', 'email')
})
