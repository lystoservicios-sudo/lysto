import { createHash, randomUUID } from 'node:crypto'
import { Client } from 'pg'
import type { Locator, Page, Response } from '@playwright/test'

import { test, expect, loginAs } from './fixtures/production'
import type { FixtureAccount } from './fixtures/accounts'
import type { CustomerAssetAddress, CustomerAssetEquipment } from '@/lib/customer-assets/contracts'
import type { CustomerHome, CustomerHomesSnapshot, HomeKind } from '@/lib/customer-homes/contracts'
import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'
import { selectFixtureLocation } from '../integration/location-fixture'

type CreatedAssets = { homeIds: string[]; addressIds: string[]; equipmentIds: string[] }
const createdAssets = (): CreatedAssets => ({ homeIds: [], addressIds: [], equipmentIds: [] })
const homesPath = '/api/customer/homes'
const equipmentPath = '/api/customer/homes/equipment'
const navigation = (page: Page) => page.getByRole('navigation', { name: 'Navegación principal del cliente' })
const uuidPattern = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i
const gpuFallbackCopy = 'La vista 3D no está disponible en este dispositivo. Todos los cambios se pueden hacer desde los controles.'
const sceneControlNames = ['Girar maqueta', 'Acercar maqueta', 'Alejar maqueta', 'Restablecer vista'] as const

async function declaredSceneMode(page: Page): Promise<'webgl' | 'fallback'> {
  let mode: 'pending' | 'webgl' | 'fallback' = 'pending'
  await expect.poll(async () => {
    if (await page.getByText(gpuFallbackCopy, { exact: true }).isVisible()) mode = 'fallback'
    else if (await page.getByTestId('hogar-3d-canvas').isVisible()) mode = 'webgl'
    return mode
  }, { timeout: 15_000, message: 'Hogar must render a real canvas or explicitly declare its list fallback' }).not.toBe('pending')
  return mode as 'webgl' | 'fallback'
}

async function expectListFallback(page: Page) {
  await expect(page.getByText(gpuFallbackCopy, { exact: true })).toBeVisible()
  await expect(page.getByTestId('hogar-3d-canvas')).toHaveCount(0)
  // The parent removes unsupported controls entirely; no invalid 3D action
  // can remain enabled. This is not a skip or an accepted blank canvas.
  await expect(page.locator('.hogar-scene-controls button:enabled')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Volver a 3D', exact: true })).toHaveCount(0)
}

async function canvasDigest(canvas: Locator): Promise<string> {
  // Browser screenshots capture WebGL without preserveDrawingBuffer. Suppress
  // sibling UI only for this capture, so focus/hover/label motion cannot stand
  // in for a rendered scene change. Pixels are never logged or attached.
  const pixels = await canvas.screenshot({
    animations: 'disabled', timeout: 5_000,
    style: '.hogar-scene-label, .hogar-scene-controls { visibility: hidden !important; }'
  })
  return createHash('sha256').update(pixels).digest('hex')
}

async function stableCanvasDigest(canvas: Locator): Promise<string> {
  let previous = '', latest = ''
  await expect.poll(async () => {
    latest = await canvasDigest(canvas)
    const stable = latest === previous
    previous = latest
    return stable
  }, { timeout: 10_000, intervals: [150, 300, 600], message: 'The actual WebGL frame must settle before a visual interaction comparison' }).toBe(true)
  return latest
}

async function expectCanvasChange(canvas: Locator, before: string, description: string): Promise<string> {
  await expect.poll(() => canvasDigest(canvas), {
    timeout: 10_000, intervals: [150, 300, 600], message: description
  }).not.toBe(before)
  return stableCanvasDigest(canvas)
}

async function expectRealWebGL(page: Page) {
  const canvas = page.getByTestId('hogar-3d-canvas')
  await expect(canvas).toHaveCount(1)
  await expect(canvas).toBeVisible({ timeout: 15_000 })
  const context = await canvas.evaluate(element => {
    const canvas = element as HTMLCanvasElement
    const gl = canvas.getContext('webgl2')
    return { available: gl !== null, lost: gl?.isContextLost(), width: gl?.drawingBufferWidth ?? 0, height: gl?.drawingBufferHeight ?? 0 }
  })
  expect(context.available).toBe(true)
  expect(context.lost).toBe(false)
  expect(context.width).toBeGreaterThan(100)
  expect(context.height).toBeGreaterThan(100)
  for (const name of sceneControlNames) await expect(page.getByRole('button', { name, exact: true })).toBeEnabled()
  return canvas
}

async function homeResponse(page: Page, method: 'POST' | 'PUT' | 'DELETE', action: () => Promise<unknown>, path = homesPath): Promise<Response> {
  const pending = page.waitForResponse(candidate => new URL(candidate.url()).pathname === path && candidate.request().method() === method)
  await action()
  const response = await pending
  expect(response.ok(), `Hogar ${method} must persist through its authenticated API`).toBe(true)
  expect(response.request().headers()['x-lysto-customer-id']).toMatch(uuidPattern)
  return response
}

async function saveHome(page: Page, button: string): Promise<CustomerHome> {
  const response = await homeResponse(page, 'PUT', () => page.getByRole('button', { name: button, exact: true }).click())
  const result = await response.json() as { home: CustomerHome }
  expect(result.home.id).toMatch(uuidPattern)
  await expect(page.getByLabel('Hogar actual')).toHaveValue(result.home.id)
  return result.home
}

async function readHomes(page: Page, account: FixtureAccount): Promise<CustomerHomesSnapshot> {
  const response = await page.request.get(homesPath, { headers: { 'X-Lysto-Customer-Id': account.entityId } })
  expect(response.ok()).toBe(true)
  return await response.json() as CustomerHomesSnapshot
}

async function createHome(page: Page, created: CreatedAssets, options: { name: string; kind: HomeKind; addressId?: string; newAddress?: boolean }): Promise<CustomerHome> {
  await page.getByRole('button', { name: /^(Crear mi primer hogar|Añadir otro hogar)$/ }).click()
  await expect(navigation(page)).toHaveCount(0)
  await page.getByLabel('Nombre del hogar').fill(options.name)
  await page.getByLabel('Tipo de lugar').selectOption(options.kind)
  if (options.kind === 'apartment') await page.getByLabel('Tipo de edificio').selectOption('high')
  await page.getByLabel('Distribución inicial').selectOption('empty')
  if (options.newAddress) {
    await page.getByRole('radio', { name: 'Crear una dirección', exact: true }).check()
    await selectFixtureLocation(page)
    await page.getByLabel('Piso de la dirección').fill('8')
  } else {
    expect(options.addressId).toMatch(uuidPattern)
    await page.getByRole('radio', { name: 'Usar una dirección guardada', exact: true }).check()
    await page.getByLabel('Dirección', { exact: true }).selectOption(options.addressId!)
  }
  const response = await homeResponse(page, 'POST', () => page.getByRole('button', { name: 'Crear hogar', exact: true }).click())
  const result = await response.json() as { home: CustomerHome; address?: CustomerAssetAddress }
  expect(result.home.id).toMatch(uuidPattern)
  created.homeIds.push(result.home.id)
  if (result.address) created.addressIds.push(result.address.id)
  await expect(page.getByLabel('Hogar actual')).toHaveValue(result.home.id)
  await expect(navigation(page)).toBeVisible()
  return result.home
}

async function addRoom(page: Page, name: string, kind: string, variant: string): Promise<CustomerHome> {
  await page.getByRole('region', { name: 'Ambientes de la planta' }).getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(navigation(page)).toHaveCount(0)
  await page.getByLabel('Tipo de ambiente').selectOption(kind)
  await page.getByLabel('Variante', { exact: true }).selectOption(variant)
  await page.getByLabel('Nombre del ambiente').fill(name)
  const home = await saveHome(page, 'Guardar ambiente')
  await expect(page.getByRole('button', { name: `Abrir ${name}`, exact: true })).toBeVisible()
  return home
}

async function registerAir(page: Page, created: CreatedAssets, nickname: string): Promise<{ home: CustomerHome; equipment: CustomerAssetEquipment }> {
  await page.getByRole('button', { name: 'Añadir aire', exact: true }).click()
  await expect(navigation(page)).toHaveCount(0)
  await page.getByLabel('Nombre del aire').fill(nickname)
  await page.getByLabel('Tipo de aire').selectOption('inverter')
  await page.getByLabel('Marca (opcional)').fill('Equipo QA')
  await page.getByLabel('Modelo (opcional)').fill('Modelo QA 4500')
  await page.getByLabel('Frigorías (opcional)').fill('4500')
  await page.getByLabel('Pared', { exact: true }).selectOption('west')
  // Use real keyboard interactions; range controls are not fillable text inputs.
  await page.getByLabel('Posición sobre la pared').press('ArrowRight')
  const offset = Number(await page.getByLabel('Posición sobre la pared').inputValue())
  expect(offset).toBeGreaterThan(.5)
  await page.getByLabel('Altura orientativa').press('ArrowLeft')
  const height = Number(await page.getByLabel('Altura orientativa').inputValue())
  expect(height).toBeLessThan(2)
  const response = await homeResponse(page, 'POST', () => page.getByRole('button', { name: 'Registrar y ubicar aire', exact: true }).click(), equipmentPath)
  const result = await response.json() as { home: CustomerHome; equipment: CustomerAssetEquipment }
  expect(result.equipment.id).toMatch(uuidPattern)
  created.equipmentIds.push(result.equipment.id)
  expect(result.home.placements.find(placement => placement.equipmentId === result.equipment.id)).toMatchObject({ wall: 'west', offset, height })
  await expect(page.getByRole('heading', { name: nickname, exact: true })).toBeVisible()
  await expect(navigation(page)).toBeVisible()
  return result
}

async function confirmRemoval(page: Page, button: string): Promise<CustomerHome> {
  await page.getByRole('button', { name: button, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(navigation(page)).toHaveCount(0)
  const response = await homeResponse(page, 'PUT', () => dialog.getByRole('button', { name: 'Confirmar', exact: true }).click())
  const result = await response.json() as { home: CustomerHome }
  await expect(dialog).toHaveCount(0)
  await expect(navigation(page)).toBeVisible()
  return result.home
}

async function switchCustomer(page: Page, account: FixtureAccount, name: 'customerA' | 'customerB') {
  // Use the real logout endpoint, keeping the staging protection cookie intact.
  const response = await page.request.post('/auth/logout', { headers: { Origin: new URL(page.url()).origin }, maxRedirects: 0 })
  expect(response.status()).toBe(303)
  await loginAs(page, account, name)
}

async function cleanupCreated(account: FixtureAccount, created: CreatedAssets) {
  if (!created.homeIds.length && !created.equipmentIds.length && !created.addressIds.length) return
  // The same repository guard as the existing fixtures refuses production targets.
  // Every deletion is further bounded by this synthetic owner and recorded UUIDs.
  const target = assertTestEnvironment(process.env, readTestIdentity(process.env))
  const db = new Client({ connectionString: target.databaseUrl, connectionTimeoutMillis: 5_000, query_timeout: 10_000, statement_timeout: 10_000, lock_timeout: 5_000 })
  await db.connect()
  try {
    await db.query('begin')
    try {
      await db.query('delete from private.customer_home_operations where customer_id=$1 and result->\'home\'->>\'id\'=any($2::text[])', [account.entityId, created.homeIds])
      await db.query('delete from public.customer_homes where customer_id=$1 and id=any($2::uuid[])', [account.entityId, created.homeIds])
      await db.query('delete from public.customer_equipment where customer_id=$1 and id=any($2::uuid[])', [account.entityId, created.equipmentIds])
      await db.query('delete from public.customer_addresses where customer_id=$1 and id=any($2::uuid[])', [account.entityId, created.addressIds])
      await db.query('commit')
    } catch (error) { await db.query('rollback'); throw error }
  } finally { await db.end() }
}

test.describe('authenticated customer Hogar with a disposable backend', () => {
  test.setTimeout(120_000)

  test('renders and manipulates the actual home canvas while isolating rooms and showing one floor at a time', async ({ page, accounts, browserName }) => {
    const created = createdAssets(), customer = accounts.accounts.customerA
    try {
      // Deterministic camera settling, while still exercising real controls,
      // pointer events, rendering and the product's reduced-motion handling.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await loginAs(page, customer, 'customerA'); await page.goto('/app/hogar')
      const original = await createHome(page, created, { name: 'Casa 3D QA', kind: 'house', newAddress: true })
      const lowerId = original.floors[0].id
      const withLiving = await addRoom(page, 'Living 3D QA', 'living', 'family')
      const livingId = withLiving.floors[0].rooms.find(room => room.name === 'Living 3D QA')!.id
      await addRoom(page, 'Cocina 3D QA', 'kitchen', 'island')
      const mode = await declaredSceneMode(page)
      // Chromium must supply real rendering evidence. WebKit may have no GPU,
      // but still must exercise the declared, working fallback without skipping.
      if (browserName !== 'webkit') expect(mode).toBe('webgl')
      const labels = page.locator('.hogar-scene-label')
      const canvas = mode === 'webgl' ? await expectRealWebGL(page) : null
      if (canvas) {
        await expect(labels).toHaveCount(2)
        // Returning from the room editor restores the user's previous floor
        // camera. Establish the canonical reset frame before testing reset.
        await page.getByRole('button', { name: 'Restablecer vista', exact: true }).click()
        const initialFrame = await stableCanvasDigest(canvas)
        await page.getByRole('button', { name: 'Girar maqueta', exact: true }).click()
        const rotated = await expectCanvasChange(canvas, initialFrame, 'Rotate must change the rendered room geometry, not only an HTML control')
        await page.getByRole('button', { name: 'Acercar maqueta', exact: true }).click()
        const zoomed = await expectCanvasChange(canvas, rotated, 'Zoom in must change the actual WebGL frame')
        await page.getByRole('button', { name: 'Alejar maqueta', exact: true }).click()
        await expectCanvasChange(canvas, zoomed, 'Zoom out must change the actual WebGL frame')
        await page.getByRole('button', { name: 'Restablecer vista', exact: true }).click()
        await expect.poll(() => canvasDigest(canvas), { timeout: 10_000 }).toBe(initialFrame)
        const box = await canvas.boundingBox()
        expect(box).not.toBeNull()
        if (!box) throw new Error('The live home canvas has no usable pointer bounds')
        await page.mouse.move(box.x + box.width * .32, box.y + box.height * .46)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width * .68, box.y + box.height * .46, { steps: 12 })
        await page.mouse.up()
        await expectCanvasChange(canvas, initialFrame, 'A real pointer drag must rotate the rendered scene')
        await expect(page.getByRole('button', { name: 'Volver a la planta', exact: true })).toHaveCount(0)
        await page.getByRole('button', { name: 'Restablecer vista', exact: true }).click()
        await expect.poll(() => canvasDigest(canvas), { timeout: 10_000 }).toBe(initialFrame)
        const label = page.getByRole('button', { name: 'Seleccionar Living 3D QA en la maqueta', exact: true })
        await expect(label).toBeVisible()
        const target = await label.boundingBox()
        expect(target).not.toBeNull()
        if (!target) throw new Error('The rendered living room has no projected selection target')
        // Labels intentionally pass pointer events to the canvas. Clicking this
        // observed projection therefore exercises the live room raycast.
        await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2)
        await expect(page.locator('.hogar-scene')).toHaveClass(/is-focused/)
        await expect(labels).toHaveCount(1)
        await expect(page.getByRole('button', { name: 'Seleccionar Cocina 3D QA en la maqueta', exact: true })).toHaveCount(0)
        await expectCanvasChange(canvas, initialFrame, 'Entering one room must render that room in isolation')
      } else {
        await expectListFallback(page)
        await page.getByRole('button', { name: 'Abrir Living 3D QA', exact: true }).click()
      }
      await expect(page.getByRole('heading', { name: 'Living 3D QA', exact: true }).first()).toBeVisible()
      await expect(page.getByRole('button', { name: 'Abrir Cocina 3D QA', exact: true })).toHaveCount(0)
      await page.getByRole('button', { name: 'Añadir aire', exact: true }).click()
      await expect(page.getByLabel('Ambiente', { exact: true })).toHaveValue(livingId)
      await expect(navigation(page)).toHaveCount(0)
      if (canvas) {
        await expect(page.locator('.hogar-scene')).toHaveClass(/is-focused.*is-placing/)
        await expect(labels).toHaveCount(0)
        await expectRealWebGL(page)
      } else await expectListFallback(page)
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
      await expect(navigation(page)).toBeVisible()
      await page.getByRole('button', { name: 'Volver a la planta', exact: true }).click()
      await page.getByRole('button', { name: 'Planta', exact: true }).click()
      await page.getByLabel('Nombre de la planta').fill('Planta alta 3D QA')
      const withUpper = await saveHome(page, 'Guardar planta')
      const upper = withUpper.floors.find(floor => floor.id !== lowerId)!
      await addRoom(page, 'Dormitorio 3D QA', 'bedroom', 'double')
      await expect(page.getByLabel('Planta actual', { exact: true })).toHaveValue(upper.id)
      await expect(page.getByRole('button', { name: 'Abrir Living 3D QA', exact: true })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Abrir Dormitorio 3D QA', exact: true })).toBeVisible()
      if (canvas) {
        await expect(labels).toHaveCount(1)
        await expect(page.getByRole('button', { name: 'Seleccionar Dormitorio 3D QA en la maqueta', exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Seleccionar Living 3D QA en la maqueta', exact: true })).toHaveCount(0)
      } else await expectListFallback(page)
      await page.getByLabel('Planta actual', { exact: true }).selectOption(lowerId)
      await expect(page.getByRole('button', { name: 'Abrir Living 3D QA', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Abrir Dormitorio 3D QA', exact: true })).toHaveCount(0)
      if (canvas) {
        await expect(labels).toHaveCount(2)
        await expect(page.getByRole('button', { name: 'Seleccionar Dormitorio 3D QA en la maqueta', exact: true })).toHaveCount(0)
        await page.getByRole('button', { name: 'Lista', exact: true }).click()
        await expect(page.getByTestId('hogar-3d-canvas')).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Volver a 3D', exact: true })).toBeEnabled()
        await page.getByRole('button', { name: 'Volver a 3D', exact: true }).click()
        await expectRealWebGL(page)
        await expect(labels).toHaveCount(2)
      }
      const persisted = (await readHomes(page, customer)).homes.find(home => home.id === original.id)!
      expect(persisted.floors).toHaveLength(2)
      expect(persisted.placements).toHaveLength(0)
    } finally { await cleanupCreated(customer, created) }
  })

  test('keeps real room, floor and air workflows usable when WebGL2 is unavailable', async ({ page, accounts }) => {
    const created = createdAssets(), customer = accounts.accounts.customerA
    try {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'WebGL2RenderingContext', { configurable: true, value: undefined })
      })
      await loginAs(page, customer, 'customerA'); await page.goto('/app/hogar')
      const original = await createHome(page, created, { name: 'Casa sin GPU QA', kind: 'house', newAddress: true })
      expect(await page.evaluate(() => typeof window.WebGL2RenderingContext)).toBe('undefined')
      await expectListFallback(page)
      await addRoom(page, 'Living sin GPU QA', 'living', 'compact')
      await page.getByRole('button', { name: 'Editar Living sin GPU QA', exact: true }).click()
      await page.getByLabel('Nombre del ambiente').fill('Living editado sin GPU QA')
      await saveHome(page, 'Guardar ambiente')
      await expectListFallback(page)
      await page.getByRole('button', { name: 'Planta', exact: true }).click()
      await page.getByLabel('Nombre de la planta').fill('Planta alta sin GPU QA')
      const withUpper = await saveHome(page, 'Guardar planta')
      const upper = withUpper.floors.find(floor => floor.id !== original.floors[0].id)!
      const withBedroom = await addRoom(page, 'Dormitorio sin GPU QA', 'bedroom', 'guest')
      const bedroom = withBedroom.floors.find(floor => floor.id === upper.id)!.rooms[0]
      await expect(page.getByRole('button', { name: 'Abrir Living editado sin GPU QA', exact: true })).toHaveCount(0)
      const registered = await registerAir(page, created, 'Aire sin GPU QA')
      expect(registered.home.placements[0].roomId).toBe(bedroom.id)
      await expectListFallback(page)
      await page.reload()
      await page.getByLabel('Planta actual', { exact: true }).selectOption(upper.id)
      await expectListFallback(page)
      await expect(page.getByRole('heading', { name: 'Aire sin GPU QA', exact: true })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Historial de Aire sin GPU QA', exact: true })).toHaveAttribute('href', `/app/equipos/${registered.equipment.id}`)
      await page.getByRole('button', { name: 'Reubicar Aire sin GPU QA', exact: true }).click()
      await expect(page.getByLabel('Ambiente', { exact: true })).toHaveValue(bedroom.id)
      await expectListFallback(page)
      await page.getByLabel('Pared', { exact: true }).selectOption('east')
      await saveHome(page, 'Guardar ubicación')
      await expectListFallback(page)
      const persisted = await readHomes(page, customer)
      const persistedHome = persisted.homes.find(home => home.id === original.id)!
      expect(persistedHome.floors.find(floor => floor.id === original.floors[0].id)!.rooms[0].name).toBe('Living editado sin GPU QA')
      expect(persistedHome.placements).toEqual([{ ...registered.home.placements[0], wall: 'east' }])
      expect(persisted.equipment.filter(equipment => equipment.id === registered.equipment.id)).toHaveLength(1)
      await expect(navigation(page)).toBeVisible()
    } finally { await cleanupCreated(customer, created) }
  })

  test('creates, configures and archives a real home while keeping its postal address', async ({ page, accounts }) => {
    const created = createdAssets(), customer = accounts.accounts.customerA
    try {
      await loginAs(page, customer, 'customerA')
      await page.goto('/app/hogar')
      await expect(page.getByRole('heading', { name: 'Tu hogar, a tu manera' })).toBeVisible()
      const original = await createHome(page, created, { name: 'Casa QA', kind: 'house', newAddress: true })
      expect(original.floors).toHaveLength(1)
      expect(original.floors[0].rooms).toHaveLength(0)
      await expect(page.getByText('Calle Hogar QA 456 · Piso 8, Buenos Aires', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Configurar hogar', exact: true }).click()
      await page.getByLabel('Nombre del hogar').fill('Casa QA configurada')
      await page.getByLabel('Tiene balcón').check()
      await page.getByLabel('Ventanas del hogar').selectOption('mixed')
      const configured = await saveHome(page, 'Guardar configuración')
      expect(configured).toMatchObject({ id: original.id, addressId: original.addressId, name: 'Casa QA configurada', features: { balcony: true, terrace: false, windows: 'mixed' } })
      expect(configured.floors[0].id).toBe(original.floors[0].id)
      await page.reload()
      await expect(page.getByLabel('Hogar actual')).toHaveValue(original.id)
      await expect(page.getByLabel('Hogar actual').getByRole('option', { name: 'Casa QA configurada', exact: true })).toBeAttached()
      await expect(page.getByText('Ventanas mixtas', { exact: true })).toBeVisible()
      expect((await readHomes(page, customer)).homes.find(home => home.id === original.id)).toMatchObject({ name: 'Casa QA configurada', features: configured.features })

      await page.getByRole('button', { name: 'Archivar hogar', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: '¿Archivar este hogar?', exact: true })
      await homeResponse(page, 'DELETE', () => dialog.getByRole('button', { name: 'Confirmar', exact: true }).click())
      await expect(page.getByRole('heading', { name: 'Tu hogar, a tu manera' })).toBeVisible()
      await page.reload()
      const persisted = await readHomes(page, customer)
      expect(persisted.homes.some(home => home.id === original.id)).toBe(false)
      expect(persisted.addresses.some(address => address.id === original.addressId && !address.archivedAt)).toBe(true)
      await expect(page.getByRole('button', { name: 'Crear mi primer hogar', exact: true })).toBeVisible()
    } finally { await cleanupCreated(customer, created) }
  })

  test('persists individual floors, room variants and a real air placement across reloads', async ({ page, accounts }) => {
    const created = createdAssets(), customer = accounts.accounts.customerA
    try {
      await loginAs(page, customer, 'customerA'); await page.goto('/app/hogar')
      const initial = await readHomes(page, customer)
      const original = await createHome(page, created, { name: 'Departamento QA', kind: 'apartment', addressId: initial.addresses.find(address => !address.archivedAt)!.id })
      const lowerId = original.floors[0].id
      await addRoom(page, 'Living QA', 'living', 'dining')
      await page.getByRole('button', { name: 'Planta', exact: true }).click()
      await page.getByLabel('Nombre de la planta').fill('Planta alta QA')
      const withUpper = await saveHome(page, 'Guardar planta')
      const upper = withUpper.floors.find(floor => floor.id !== lowerId)!
      await expect(page.getByLabel('Planta actual', { exact: true })).toHaveValue(upper.id)
      await expect(page.getByRole('button', { name: 'Abrir Living QA', exact: true })).toHaveCount(0)
      const withBedroom = await addRoom(page, 'Dormitorio QA', 'bedroom', 'double')
      const bedroom = withBedroom.floors.find(floor => floor.id === upper.id)!.rooms.find(room => room.name === 'Dormitorio QA')!
      expect(bedroom).toMatchObject({ kind: 'bedroom', variant: 'double' })
      await page.getByLabel('Planta actual', { exact: true }).selectOption(lowerId)
      await expect(page.getByRole('button', { name: 'Abrir Living QA', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Abrir Dormitorio QA', exact: true })).toHaveCount(0)
      await page.getByLabel('Planta actual', { exact: true }).selectOption(upper.id)
      await page.getByRole('button', { name: 'Editar planta actual', exact: true }).click()
      await page.getByLabel('Nombre de la planta').fill('Dormitorios QA')
      await page.getByLabel('Orden de la planta').selectOption('0')
      const reordered = await saveHome(page, 'Guardar planta')
      expect(reordered.floors.map(floor => [floor.id, floor.order])).toEqual([[upper.id, 0], [lowerId, 1]])
      await page.getByRole('button', { name: 'Abrir Dormitorio QA', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Dormitorio QA', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Volver a la planta', exact: true })).toBeVisible()
      const registered = await registerAir(page, created, 'Aire dormitorio QA')
      expect(registered.home.placements[0].roomId).toBe(bedroom.id)
      await page.reload()
      await expect(page.getByLabel('Planta actual', { exact: true })).toHaveValue(upper.id)
      await expect(page.getByRole('button', { name: 'Abrir Living QA', exact: true })).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Aire dormitorio QA', exact: true })).toHaveCount(1)
      await expect(page.getByRole('link', { name: 'Historial de Aire dormitorio QA', exact: true })).toHaveAttribute('href', `/app/equipos/${registered.equipment.id}`)
      const persisted = await readHomes(page, customer), persistedHome = persisted.homes.find(home => home.id === original.id)!
      expect(persistedHome.floors.find(floor => floor.id === upper.id)!.rooms.find(room => room.id === bedroom.id)).toMatchObject({ name: 'Dormitorio QA', variant: 'double' })
      expect(persistedHome.placements).toEqual(registered.home.placements)
      expect(persisted.equipment.filter(equipment => equipment.id === registered.equipment.id)).toHaveLength(1)
      expect(persisted.equipment.find(equipment => equipment.id === registered.equipment.id)).toMatchObject({ addressId: original.addressId, equipmentType: 'inverter', frigorias: '4500' })

      const withoutRoom = await confirmRemoval(page, 'Quitar Dormitorio QA')
      expect(withoutRoom.placements).toHaveLength(0)
      await expect(page.getByText('Sin ubicar', { exact: true })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Historial de Aire dormitorio QA', exact: true })).toHaveAttribute('href', `/app/equipos/${registered.equipment.id}`)
      await page.getByRole('button', { name: 'Editar planta actual', exact: true }).click()
      const withoutUpper = await confirmRemoval(page, 'Quitar planta')
      expect(withoutUpper.floors.map(floor => floor.id)).toEqual([lowerId])
      await page.reload()
      await expect(page.getByRole('button', { name: 'Abrir Living QA', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Ubicar Aire dormitorio QA', exact: true })).toBeVisible()
      const afterRemoval = await readHomes(page, customer)
      expect(afterRemoval.equipment.find(equipment => equipment.id === registered.equipment.id)).toMatchObject({ addressId: original.addressId, archivedAt: null })
      expect(afterRemoval.homes.find(home => home.id === original.id)!.placements).toHaveLength(0)
    } finally { await cleanupCreated(customer, created) }
  })

  test('switches between owned homes and rejects another customer reading or writing their IDs', async ({ page, accounts }) => {
    const created = createdAssets(), customer = accounts.accounts.customerA
    try {
      await loginAs(page, customer, 'customerA'); await page.goto('/app/hogar')
      const initial = await readHomes(page, customer)
      const first = await createHome(page, created, { name: 'Casa privada QA', kind: 'house', addressId: initial.addresses.find(address => !address.archivedAt)!.id })
      await addRoom(page, 'Living privado QA', 'living', 'compact')
      const registered = await registerAir(page, created, 'Aire privado QA')
      const privateHome = registered.home
      const second = await createHome(page, created, { name: 'Oficina privada QA', kind: 'office', newAddress: true })
      await addRoom(page, 'Reuniones QA', 'meeting', 'boardroom')
      await expect(page.getByRole('heading', { name: 'Aire privado QA', exact: true })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Abrir Living privado QA', exact: true })).toHaveCount(0)
      await page.getByLabel('Hogar actual').selectOption(first.id)
      await expect(page.getByRole('button', { name: 'Abrir Living privado QA', exact: true })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Aire privado QA', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Abrir Reuniones QA', exact: true })).toHaveCount(0)
      await page.getByLabel('Hogar actual').selectOption(second.id)
      await page.reload()
      expect((await readHomes(page, customer)).homes.map(home => home.id).sort()).toEqual([first.id, second.id].sort())

      await switchCustomer(page, accounts.accounts.customerB, 'customerB')
      await page.goto('/app/hogar')
      await expect(page.getByRole('heading', { name: 'Tu hogar, a tu manera' })).toBeVisible()
      const foreignSnapshot = await readHomes(page, accounts.accounts.customerB)
      expect(foreignSnapshot.homes.some(home => created.homeIds.includes(home.id))).toBe(false)
      expect(foreignSnapshot.equipment.some(equipment => equipment.id === registered.equipment.id)).toBe(false)
      expect(foreignSnapshot.addresses.some(address => address.id === second.addressId)).toBe(false)
      const origin = new URL(page.url()).origin
      // Supply valid CSRF context: these requests must test actor/RPC isolation,
      // not accidentally pass because readPrivateJsonBody rejected a missing Origin.
      const staleInlineCreate = await page.request.post(homesPath, { headers: { Origin: origin, 'X-Lysto-Customer-Id': customer.entityId }, data: {
        name: 'Comando privado A rechazado', addressId: null,
        newAddress: { label: 'Dirección privada A rechazada', street: 'Calle privada A', number: '1', city: 'CABA', province: 'CABA', propertyType: 'house', access: {}, isDefault: false },
        kind: 'house', building: null, features: { balcony: false, terrace: false, windows: 'large' },
        floors: [{ id: randomUUID(), name: 'Principal', order: 0, rooms: [] }], placements: [], idempotencyKey: randomUUID()
      } })
      expect(staleInlineCreate.status()).toBe(403)
      expect(await staleInlineCreate.json()).toMatchObject({ code: 'forbidden' })
      expect(await readHomes(page, accounts.accounts.customerB)).toEqual(foreignSnapshot)
      const saveForeign = await page.request.put(homesPath, { headers: { Origin: origin, 'X-Lysto-Customer-Id': accounts.accounts.customerB.entityId }, data: {
        id: privateHome.id, expectedVersion: privateHome.version, name: 'Cambio ajeno rechazado',
        addressId: privateHome.addressId, kind: privateHome.kind, building: privateHome.building,
        features: privateHome.features, floors: privateHome.floors, placements: privateHome.placements
      } })
      expect(saveForeign.status()).toBe(404)
      expect(await saveForeign.json()).toMatchObject({ code: 'not_found' })
      const registerForeign = await page.request.post(equipmentPath, { headers: { Origin: origin, 'X-Lysto-Customer-Id': accounts.accounts.customerB.entityId }, data: {
        homeId: privateHome.id, expectedVersion: privateHome.version, idempotencyKey: randomUUID(),
        equipment: { nickname: 'Aire ajeno rechazado', equipmentType: 'split' },
        placement: { roomId: privateHome.floors[0].rooms[0].id, wall: 'north', offset: .5, height: 2 }
      } })
      expect(registerForeign.status()).toBe(404)
      expect(await registerForeign.json()).toMatchObject({ code: 'not_found' })
      await page.goto(`/app/equipos/${registered.equipment.id}`)
      await expect(page.getByRole('heading', { name: 'No encontramos ese equipo' })).toBeVisible()

      await switchCustomer(page, customer, 'customerA'); await page.goto('/app/hogar')
      const unchanged = await readHomes(page, customer)
      expect(unchanged.homes.find(home => home.id === first.id)).toMatchObject({ name: 'Casa privada QA', version: privateHome.version, placements: privateHome.placements })
      expect(unchanged.equipment.filter(equipment => equipment.addressId === first.addressId)).toHaveLength(1)
      expect(unchanged.equipment.find(equipment => equipment.id === registered.equipment.id)!.nickname).toBe('Aire privado QA')
      await page.getByLabel('Hogar actual').selectOption(second.id)
      await expect(page.getByRole('button', { name: 'Abrir Reuniones QA', exact: true })).toBeVisible()
    } finally { await cleanupCreated(customer, created) }
  })
})
