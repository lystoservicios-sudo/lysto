import { Client } from 'pg'
import { test, expect, loginAs } from './fixtures/production'
import type { CustomerAssetAddress } from '@/lib/customer-assets/contracts'
import type { ServiceQuote } from '@/lib/pricing/service-quote'
import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'

test('customer saves a quote through the current flow and reloads its persistent identifier', async ({
  page,
  accounts
}) => {
  test.setTimeout(60_000)
  await loginAs(page, accounts.accounts.customerA, 'customerA')
  const addresses = await page.request.get('/api/customer/addresses')
  expect(addresses.status()).toBe(200)
  const ownedAddress = ((await addresses.json()).items as CustomerAssetAddress[])
    .find(address => address.isDefault && !address.archivedAt)
  expect(Boolean(ownedAddress)).toBe(true)
  if (!ownedAddress) throw new Error('The synthetic customer must own a saved address')
  let quoteId: string | undefined
  const target = assertTestEnvironment(process.env, readTestIdentity(process.env))
  try {
    await page.goto('/app/solicitar/aire-acondicionado')
    await page.getByRole('radio', { name: /No enfría/ }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('radio', { name: /Hace días/ }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByRole('heading', { name: 'El aire no enfría' })).toBeVisible()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByLabel('Usar una dirección guardada', { exact: true }).selectOption(ownedAddress.id)
    await expect(page.getByLabel('Calle', { exact: true })).toHaveValue(ownedAddress.street)
    await expect(page.getByLabel('Número', { exact: true })).toHaveValue(ownedAddress.number)
    await expect(page.getByLabel('Ciudad', { exact: true })).toHaveValue(ownedAddress.city)
    await expect(page.getByLabel('Provincia', { exact: true })).toHaveValue(ownedAddress.province)
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    const savedResponse = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/pricing/quote' && response.request().method() === 'POST'
    )
    await page.getByRole('button', { name: 'Solicitar', exact: true }).click()
    const response = await savedResponse
    expect(response.status()).toBe(200)
    const saved = await response.json() as { quoteId: string; quote: ServiceQuote; routingNotice: string | null }
    expect(saved.quoteId).toMatch(/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i)
    quoteId = saved.quoteId
    expect(saved.quote.currency).toBe('ARS')
    expect(saved.quote.total).toBeGreaterThan(0)
    // Provider credentials are stripped by the real disposable server. Persist
    // the honest review-required quote; do not stub geocoding or pretend it is ready.
    expect(saved.quote.route).toBeNull()
    expect(saved.quote.readyToOffer).toBe(false)
    expect(saved.quote.reviewReasons).toContain('travel_unverified')
    expect(saved.routingNotice).toBe('Traslado pendiente de verificación. El importe mostrado todavía no lo incluye.')
    await expect(page.getByRole('heading', { name: 'Confirmación y pago', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Ver mis presupuestos', exact: true }).click()
    const persisted = page.locator(`[data-quote-id="${quoteId}"]`)
    await expect(persisted).toBeVisible({ timeout: 15_000 })
    await expect(persisted.locator('summary')).toContainText('En revisión')
    await page.reload()
    await expect(persisted).toBeVisible({ timeout: 15_000 })
    const canonical = await page.request.get(`/api/pricing/quotes?quoteId=${quoteId}`)
    expect(canonical.status()).toBe(200)
    const rows = (await canonical.json()).quotes
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: quoteId, customer_id: accounts.accounts.customerA.entityId, status: 'needs_review', request_id: null,
      address: { street: ownedAddress.street, number: ownedAddress.number, city: ownedAddress.city, province: ownedAddress.province },
      quote: { total: saved.quote.total, readyToOffer: false, route: null }
    })
  } finally {
    if (quoteId) {
      const database = new Client({ connectionString: target.databaseUrl, connectionTimeoutMillis: 5000, query_timeout: 10000 })
      try {
        await database.connect()
        await database.query('delete from public.service_quotes where id=$1 and customer_id=$2 and request_id is null', [quoteId, accounts.accounts.customerA.entityId])
      } finally { await database.end() }
    }
  }
})

test('double click is bounded while a quote is being persisted', async ({ page, accounts }) => {
  test.setTimeout(60_000)
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
