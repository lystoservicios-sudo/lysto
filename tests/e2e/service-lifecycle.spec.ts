import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { test as productionTest, expect, loginAs } from './fixtures/production'
import { createFixtureAccounts } from '../integration/fixtures'
import type { CustomerAssetAddress } from '@/lib/customer-assets/contracts'
import type { ServiceQuote } from '@/lib/pricing/service-quote'
import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'
import { TIME_WINDOWS } from '@/lib/domain/constants'
import type { CustomerHome } from '@/lib/customer-homes/contracts'
import type { CustomerAssetEquipment } from '@/lib/customer-assets/contracts'

// Keep real login quotas independent from other specs without changing security controls.
const test = productionTest.extend({
  accounts: [
    async ({}, use) => {
      const pending = createFixtureAccounts({ directSqlAuth: process.env.APP_ENV === 'staging' })
      try {
        await use(await pending)
      } finally {
        await pending.cleanup()
      }
    },
    { scope: 'worker' }
  ]
})

test('legacy reviewed quote API preserves its persistent identifier and downstream customer detail', async ({
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
    // This contract remains supported for historical reviewed quotes. It must not
    // dictate the newly approved automatic-contract wizard or create a fake job.
    const response = await page.request.post('/api/pricing/quote', {
      headers: { origin: new URL(page.url()).origin },
      data: { issue: 'no_enfria', timeSince: 'days', urgency: 'flexible', propertyType: ownedAddress.propertyType, access: ownedAddress.access, equipment: { technology: 'unknown' }, address: { street: ownedAddress.street, number: ownedAddress.number, city: ownedAddress.city, province: ownedAddress.province, floor: ownedAddress.floor ?? '', apartment: ownedAddress.apartment ?? '' }, preferredDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), timeWindow: TIME_WINDOWS[1], uploadIntentIds: [], save: true }
    })
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
    await page.goto('/app/presupuestos')
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

test('Pedir reuses the owned room, only one real floor and safely reviews an unavailable automatic price', async ({ page, accounts }) => {
  test.setTimeout(90_000)
  assertTestEnvironment(process.env, readTestIdentity(process.env))
  await loginAs(page, accounts.accounts.customerA, 'customerA')
  const actor = accounts.accounts.customerA.entityId
  const headers = { origin: new URL(page.url()).origin, 'X-Lysto-Customer-Id': actor }
  const addresses = ((await (await page.request.get('/api/customer/addresses')).json()).items as CustomerAssetAddress[])
  const address = addresses.find(a => !a.archivedAt)
  if (!address) throw new Error('Synthetic customer must own an address')
  const firstFloorId = randomUUID(), floorId = randomUUID(), roomId = randomUUID()
  let home: CustomerHome | null = null
  let equipment: CustomerAssetEquipment | null = null
  try {
    const created = await page.request.post('/api/customer/homes', { headers, data: { name: 'Casa del flujo Pedir', kind: 'house', addressId: address.id, building: null, features: { balcony: false, terrace: false, windows: 'small' }, floors: [{ id: firstFloorId, name: 'Nivel principal', order: 0, rooms: [] }, { id: floorId, name: 'Altillo', order: 1, rooms: [{ id: roomId, name: 'Living del altillo', kind: 'living', variant: 'compact', x: 0, z: 0, width: 4, depth: 4, rotation: 0, windows: 'small' }] }], placements: [], idempotencyKey: randomUUID() } })
    expect(created.status()).toBe(201)
    home = (await created.json()).home
    if (!home) throw new Error('Home creation was not acknowledged')
    const registered = await page.request.post('/api/customer/homes/equipment', { headers, data: { homeId: home.id, expectedVersion: home.version, idempotencyKey: randomUUID(), equipment: { nickname: 'Aire del altillo', equipmentType: 'inverter', frigorias: 3000 }, placement: { roomId, wall: 'north', offset: .5, height: 2 } } })
    expect(registered.status()).toBe(201)
    const result = await registered.json()
    home = result.home; equipment = result.equipment
    if (!home || !equipment) throw new Error('Equipment registration was not acknowledged')
    const writes: string[] = []
    page.on('request', request => { if (request.method() !== 'GET' && new URL(request.url()).pathname.startsWith('/api/customer/homes')) writes.push(request.url()) })
    await page.goto(`/app/solicitar/aire-acondicionado?equipo=${equipment.id}`)
    await expect(page.getByRole('heading', { name: 'Aire del altillo', exact: true })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Navegación principal del cliente' })).toHaveCount(0)
    await page.getByRole('radio', { name: 'Pierde agua', exact: true }).click()
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Revisá dónde está tu aire' })).toBeVisible()
    await expect(page.getByLabel('Planta', { exact: true })).toHaveValue(floorId)
    await expect(page.getByRole('radio', { name: 'Living del altillo', exact: true })).toBeVisible()
    expect(writes).toHaveLength(0)
    await page.getByRole('button', { name: 'Continuar con los detalles', exact: true }).click()
    await page.getByRole('radio', { name: 'Hace días', exact: true }).click()
    await page.getByRole('radio', { name: 'Cuando está encendido', exact: true }).click()
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    await page.getByRole('button', { name: 'Elegir horario preferido', exact: true }).click()
    await page.getByRole('radio', { name: 'Otra fecha', exact: true }).click()
    await page.getByLabel('Fecha de visita', { exact: true }).fill(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10))
    await page.getByRole('radio', { name: TIME_WINDOWS[1], exact: true }).click()
    const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/api/customer/requests/preview')
    await page.getByRole('button', { name: 'Revisar pedido y presupuesto', exact: true }).click()
    const response = await responsePromise
    expect(response.status()).toBe(200)
    const preview = await response.json()
    // The disposable environment has no live provider/approved initial-labor policy.
    // This case proves fail-closed handling, not a simulated ready payment.
    expect(['needs_review', 'unavailable']).toContain(preview.status)
    await expect(page.getByRole('button', { name: 'Pagar con Mercado Pago', exact: true })).toBeDisabled()
    await expect(page.getByText(/También cuando|Cuando está encendido/)).toBeVisible()
    const submitted = response.request().postDataJSON()
    expect(submitted).toMatchObject({ equipmentId: equipment.id, homeId: home.id, floorId, roomId, addressId: address.id, answers: { symptom_context: 'while_on' } })
    expect(response.request().headers()['x-lysto-customer-id']).toBe(actor)
    expect(submitted.amount).toBeUndefined(); expect(submitted.professionalId).toBeUndefined()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Revisá tu pedido' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pagar con Mercado Pago', exact: true })).toBeDisabled()
  } finally {
    if (home) {
      const current = await page.request.get('/api/customer/homes', { headers })
      if (current.ok()) {
        const fresh = ((await current.json()).homes as CustomerHome[]).find(h => h.id === home!.id)
        if (fresh) await page.request.delete('/api/customer/homes', { headers, data: { id: fresh.id, expectedVersion: fresh.version } })
      }
    }
    if (equipment) await page.request.delete('/api/customer/equipment', { headers, data: { id: equipment.id, expectedVersion: equipment.version } })
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
