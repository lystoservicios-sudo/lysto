import { createHmac } from 'node:crypto'
import { expect, type Page } from '@playwright/test'
import type { ResolvedAddress, LocationKind } from '../../lib/location/contracts'
import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'

export const fixtureLocation: ResolvedAddress = {
  street: 'AV RIVADAVIA', number: '1234', city: 'San Nicolás', province: 'CABA',
  provinceId: '02', cityId: '02007010', streetId: '0200701000085',
  formattedAddress: 'Av. Rivadavia 1234, CABA, Argentina',
  latitude: -34.609, longitude: -58.385, precision: 'rooftop', source: 'georef_google'
}

/** Test-only third-party location boundary. Never signs with a production key.
 * Application writes, proof validation, Auth and the database remain real. */
export function fixtureLocationProof(overrides: Partial<ResolvedAddress> = {}) {
  assertTestEnvironment(process.env, readTestIdentity(process.env))
  if (process.env.LYSTO_TEST_ENVIRONMENT !== 'disposable')
    throw new Error('Synthetic location proofs require a local disposable database')
  const address = Object.fromEntries(Object.entries(fixtureLocation).map(([key, value]) => [key, overrides[key as keyof ResolvedAddress] ?? value]))
  const payload = Buffer.from(JSON.stringify({ version: 1, expiresAt: Date.now() + 30 * 60_000, address })).toString('base64url')
  const signature = createHmac('sha256', process.env.LYSTO_TEST_SERVICE_ROLE_KEY!)
    .update('lysto-location-proof-v1\0').update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export async function selectFixtureLocation(page: Page, options: { full?: boolean; starred?: boolean } = {}) {
  // Staging must exercise its actual configured location providers.
  if (process.env.LYSTO_TEST_ENVIRONMENT === 'disposable') {
    fixtureLocationProof()
    await page.route('**/api/location/suggestions?*', async route => {
      const kind = new URL(route.request().url()).searchParams.get('kind') as LocationKind
      const labels = { province: fixtureLocation.province, city: fixtureLocation.city, street: fixtureLocation.street, address: fixtureLocation.formattedAddress }
      const { street, number, city, province, provinceId, cityId, streetId } = fixtureLocation
      await route.fulfill({ json: { suggestions: [{ kind, id: `fixture-${kind}`, label: labels[kind], street, number, city, province, provinceId, cityId, streetId }] } })
    })
    await page.route('**/api/location/resolve', route => route.fulfill({ json: { address: fixtureLocation, proof: fixtureLocationProof() } }))
  }
  if (options.full) {
    await page.getByRole('combobox', { name: 'Dirección', exact: true }).fill('Rivadavia 1234')
  } else {
    const suffix = options.starred ? ' *' : ''
    for (const [name, value] of [['Provincia', 'CABA'], ['Ciudad', 'San Nicolás'], ['Calle', 'Rivadavia']]) {
      await page.getByRole('combobox', { name: name + suffix, exact: true }).fill(value)
      await page.getByRole('listbox', { name: `${name}${suffix} opciones`, exact: true }).getByRole('option').first().click()
    }
    await page.getByRole('combobox', { name: 'Número' + suffix, exact: true }).fill('1234')
  }
  const resolved = page.waitForResponse(response => new URL(response.url()).pathname === '/api/location/resolve' && response.request().method() === 'POST')
  const label = options.full ? 'Dirección' : 'Número' + (options.starred ? ' *' : '')
  await page.getByRole('listbox', { name: `${label} opciones`, exact: true }).getByRole('option').first().click()
  expect((await resolved).ok()).toBe(true)
  if (options.full) await expect(page.getByRole('combobox', { name: 'Dirección', exact: true })).toHaveValue(fixtureLocation.formattedAddress)
  else await expect(page.getByRole('combobox', { name: 'Calle' + (options.starred ? ' *' : ''), exact: true })).toHaveValue(fixtureLocation.street)
}
