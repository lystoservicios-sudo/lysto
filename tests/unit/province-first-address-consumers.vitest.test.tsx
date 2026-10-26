import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CompleteProfileForm } from '@/components/auth/customer-forms'
import { CustomerAddressForm } from '@/components/customer/customer-address-form'
import { CustomerHogar } from '@/components/customer/hogar/customer-hogar'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'
import type { CustomerAddressViewModel } from '@/features/customer/view-models'
import { createHomeMutationSchema } from '@/lib/customer-homes/contracts'
import type { ResolvedAddress } from '@/lib/location/contracts'
import { issueLocationProof, verifyLocationProof } from '@/lib/location/proof'

// jsdom has no WebGL; the real Hogar, address controls and form stay mounted.
vi.mock('next/dynamic', () => ({ default: () => function SceneBoundary() { return null } }))

const resolved = {
  street: 'SAN MARTIN', number: '123', city: 'Córdoba', province: 'Córdoba', provinceId: '14',
  cityId: '14014010', streetId: '1401401000123', formattedAddress: 'SAN MARTIN 123, Córdoba, Córdoba, Argentina',
  source: 'georef', precision: 'range_interpolated', latitude: -31.4167, longitude: -64.1833
} as const satisfies ResolvedAddress
const selected = { street: resolved.street, number: resolved.number, city: resolved.city, province: resolved.province }
const suggestion = { ...selected, kind: 'address', id: 'cordoba-address', label: resolved.formattedAddress,
  provinceId: resolved.provinceId, cityId: resolved.cityId, streetId: resolved.streetId } as const
const secret = 'province-consumer-proof-test-secret-32-bytes'
const proof = issueLocationProof(resolved, secret)
const displayed = 'SAN MARTIN 123, Córdoba, Córdoba'

function locationProvider(resolve = () => Promise.resolve(Response.json({ address: resolved, proof })), domain?: typeof fetch) {
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    if (path.includes('/api/location/suggestions')) {
      const params = new URL(path, 'https://lysto.test').searchParams
      expect(params.get('provinceId')).toBe('14')
      expect(params.get('province')).toBe('Córdoba')
      return Response.json({ suggestions: [suggestion] })
    }
    if (path === '/api/location/resolve') {
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toEqual({ ...selected, provinceId: resolved.provinceId, cityId: resolved.cityId, streetId: resolved.streetId })
      return resolve()
    }
    if (domain) return domain(input, init)
    throw new Error('Unexpected API boundary: ' + path)
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
async function selectResolved() {
  fireEvent.change(screen.getByRole('combobox', { name: 'Provincia' }), { target: { value: '14' } })
  fireEvent.change(screen.getByRole('combobox', { name: 'Dirección' }), { target: { value: 'San Martin 123, Córdoba' } })
  fireEvent.click(await screen.findByRole('option', { name: suggestion.label }))
}
async function confirmedResolved() {
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Dirección' })).toHaveProperty('value', displayed))
  expect(screen.getByRole('combobox', { name: 'Provincia' })).toHaveProperty('value', '14')
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('province-first addresses in real consumer forms', () => {
  it('requires province before the incomplete customer profile can search and has no manual bypass', () => {
    const fetcher = locationProvider()
    render(<CompleteProfileForm missing={['street', 'number', 'city', 'province']} next="/app" address={null} />)
    const province = screen.getByRole('combobox', { name: 'Provincia' })
    const direction = screen.getByRole('combobox', { name: 'Dirección' })
    expect(province).toHaveProperty('value', '')
    expect(province).toHaveProperty('required', true)
    expect(direction).toHaveProperty('disabled', true)
    expect(province.compareDocumentPosition(direction) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mi dirección no aparece' })).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('includes all four address fields and its signed verified proof in profile-completion FormData', async () => {
    const fetcher = locationProvider()
    const { container } = render(<CompleteProfileForm missing={['street', 'number', 'city', 'province']} next="/app" address={null} />)
    await selectResolved()
    await confirmedResolved()

    const data = Object.fromEntries(new FormData(container.querySelector('form')!))
    expect(data).toMatchObject({ ...selected, location_proof: proof, next: '/app' })
    expect(verifyLocationProof(String(data.location_proof), selected, secret)).toEqual(resolved)
    expect(screen.getByRole('button', { name: 'Guardar y continuar' })).toHaveProperty('disabled', false)
    expect(fetcher.mock.calls.filter(([input]) => String(input) === '/api/location/resolve')).toHaveLength(1)
  })

  it('enables address saving with the verified proof and preserves floor, apartment and access edits made during resolution', async () => {
    let finish!: (response: Response) => void
    locationProvider(() => new Promise<Response>(resolve => { finish = resolve }))
    const onSubmit = vi.fn(async (value: CustomerAddressViewModel, locationProof: string) => {
      expect(verifyLocationProof(locationProof, value, secret)).toEqual(resolved)
      return { ok: true, message: 'Dirección guardada' }
    })
    render(<CustomerAddressForm initialValue={customerDemoFixtures.addresses[0]} onSubmit={onSubmit} />)
    await selectResolved()
    await waitFor(() => expect(finish).toBeTypeOf('function'))

    fireEvent.change(screen.getByRole('textbox', { name: 'Piso' }), { target: { value: '8' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Departamento' }), { target: { value: 'C' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hay estacionamiento' }))
    await act(async () => { finish(Response.json({ address: resolved, proof })); await Promise.resolve() })
    await confirmedResolved()

    const save = screen.getByRole('button', { name: 'Guardar dirección' })
    expect(save).toHaveProperty('disabled', false)
    fireEvent.click(save)
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith({ ...customerDemoFixtures.addresses[0], ...selected,
      floor: '8', apartment: 'C', access: { ...customerDemoFixtures.addresses[0].access, hasParking: true } }, proof)
    expect(verifyLocationProof(onSubmit.mock.calls[0][1], onSubmit.mock.calls[0][0], secret)).toEqual(resolved)
    expect(await screen.findByText('Dirección guardada')).toBeTruthy()
  })

  it('invalidates a selected customer address when its province changes and blocks saving', async () => {
    locationProvider()
    const onSubmit = vi.fn()
    render(<CustomerAddressForm initialValue={customerDemoFixtures.addresses[0]} onSubmit={onSubmit} />)
    await selectResolved(); await confirmedResolved()
    expect(screen.getByRole('button', { name: 'Guardar dirección' })).toHaveProperty('disabled', false)
    fireEvent.change(screen.getByRole('combobox', { name: 'Provincia' }), { target: { value: '82' } })
    expect(screen.getByRole('combobox', { name: 'Dirección' })).toHaveProperty('value', '')
    expect(screen.getByRole('button', { name: 'Guardar dirección' })).toHaveProperty('disabled', true)
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar dirección' }).closest('form')!)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects a legacy manual resolution in the customer form instead of enabling saving', async () => {
    locationProvider(async () => Response.json({ address: { ...resolved, source: 'manual', precision: 'unverified', latitude: null, longitude: null }, proof: 'legacy-manual-proof' }))
    const onSubmit = vi.fn()
    render(<CustomerAddressForm initialValue={customerDemoFixtures.addresses[0]} onSubmit={onSubmit} />)
    await selectResolved(); await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Guardar dirección' })).toHaveProperty('disabled', true)
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar dirección' }).closest('form')!)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('creates Hogar with a new resolved address and proof in the same atomic request', async () => {
    const homeId = '10000000-0000-4000-8000-000000000013'
    const addressId = '10000000-0000-4000-8000-000000000014'
    const create = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('/api/customer/homes')
      expect(init?.method).toBe('POST')
      const body = createHomeMutationSchema.parse(JSON.parse(String(init?.body)))
      expect(body).toMatchObject({ name: 'Hogar Córdoba', addressId: null, newAddress: { ...selected, locationProof: proof } })
      expect(verifyLocationProof(body.newAddress!.locationProof!, body.newAddress!, secret)).toEqual(resolved)
      return Response.json({
        home: { id: homeId, version: 1, name: body.name, addressId, kind: body.kind, building: body.building,
          features: body.features, floors: body.floors, placements: body.placements },
        address: { ...body.newAddress, locationProof: undefined, id: addressId, version: 1,
          createdAt: '2026-10-26', archivedAt: null }
      })
    })
    locationProvider(undefined, create)
    render(<CustomerHogar initialData={{ homes: [], addresses: [], equipment: [] }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Crear mi primer hogar' }))
    fireEvent.change(screen.getByLabelText('Nombre del hogar'), { target: { value: 'Hogar Córdoba' } })
    fireEvent.change(screen.getByLabelText('Tipo de lugar'), { target: { value: 'house' } })
    await selectResolved()
    await confirmedResolved()
    fireEvent.click(screen.getByRole('button', { name: 'Crear hogar' }))
    await waitFor(() => expect(screen.getByLabelText('Hogar actual')).toHaveProperty('value', homeId))
    expect(create).toHaveBeenCalledTimes(1)
  })
})
