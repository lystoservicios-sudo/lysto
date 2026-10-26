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

const manual = {
  street: 'PAVON', number: '2012', city: 'Merlo', province: 'Buenos Aires', provinceId: '06',
  formattedAddress: 'PAVON 2012, Merlo, Buenos Aires, Argentina',
  source: 'manual', precision: 'unverified', latitude: null, longitude: null
} as const satisfies ResolvedAddress
const selected = { street: manual.street, number: manual.number, city: manual.city, province: manual.province }
const secret = 'manual-consumer-proof-test-secret-32-bytes'
const proof = issueLocationProof(manual, secret)
const displayed = 'PAVON 2012, Merlo, Buenos Aires'

function locationProvider(resolve = () => Promise.resolve(Response.json({ address: manual, proof })), domain?: typeof fetch) {
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    if (path.includes('/api/location/suggestions')) return Response.json({ suggestions: [] })
    if (path === '/api/location/resolve') {
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toEqual({ mode: 'manual', ...selected })
      return resolve()
    }
    if (domain) return domain(input, init)
    throw new Error(`Unexpected API boundary: ${path}`)
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

function fillManual() {
  fireEvent.click(screen.getByRole('button', { name: 'Mi dirección no aparece' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Calle' }), { target: { value: manual.street } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Altura' }), { target: { value: manual.number } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Localidad' }), { target: { value: manual.city } })
  fireEvent.change(screen.getByRole('combobox', { name: 'Provincia' }), { target: { value: manual.province } })
  fireEvent.click(screen.getByRole('button', { name: 'Usar esta dirección' }))
}

async function confirmedManual() {
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Dirección' })).toHaveProperty('value', displayed))
  expect(screen.getByText(/Dirección ingresada manualmente/)).toBeTruthy()
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('manual addresses in real consumer forms', () => {
  it('includes all four address fields and its signed manual proof in profile-completion FormData', async () => {
    const fetcher = locationProvider()
    const { container } = render(<CompleteProfileForm missing={['street', 'number', 'city', 'province']} next="/app" address={null} />)
    fillManual()
    await confirmedManual()

    const data = Object.fromEntries(new FormData(container.querySelector('form')!))
    expect(data).toMatchObject({ ...selected, location_proof: proof, next: '/app' })
    expect(verifyLocationProof(String(data.location_proof), selected, secret)).toEqual(manual)
    expect(screen.getByRole('button', { name: 'Guardar y continuar' })).toHaveProperty('disabled', false)
    expect(fetcher.mock.calls.filter(([input]) => String(input) === '/api/location/resolve')).toHaveLength(1)
  })

  it('enables address saving with the manual proof and preserves floor, apartment and access edits made during resolution', async () => {
    let finish!: (response: Response) => void
    locationProvider(() => new Promise<Response>(resolve => { finish = resolve }))
    const onSubmit = vi.fn(async (value: CustomerAddressViewModel, locationProof: string) => {
      expect(verifyLocationProof(locationProof, value, secret)).toEqual(manual)
      return { ok: true, message: 'Dirección guardada' }
    })
    render(<CustomerAddressForm initialValue={customerDemoFixtures.addresses[0]} onSubmit={onSubmit} />)
    fillManual()
    await waitFor(() => expect(finish).toBeTypeOf('function'))

    fireEvent.change(screen.getByRole('textbox', { name: 'Piso' }), { target: { value: '8' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Departamento' }), { target: { value: 'C' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hay estacionamiento' }))
    await act(async () => { finish(Response.json({ address: manual, proof })); await Promise.resolve() })
    await confirmedManual()

    const save = screen.getByRole('button', { name: 'Guardar dirección' })
    expect(save).toHaveProperty('disabled', false)
    fireEvent.click(save)
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith({ ...customerDemoFixtures.addresses[0], ...selected,
      floor: '8', apartment: 'C', access: { ...customerDemoFixtures.addresses[0].access, hasParking: true } }, proof)
    expect(verifyLocationProof(onSubmit.mock.calls[0][1], onSubmit.mock.calls[0][0], secret)).toEqual(manual)
    expect(await screen.findByText('Dirección guardada')).toBeTruthy()
  })

  it('creates Hogar with a new manual address and proof in the same atomic request', async () => {
    const homeId = '10000000-0000-4000-8000-000000000013'
    const addressId = '10000000-0000-4000-8000-000000000014'
    const create = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('/api/customer/homes')
      expect(init?.method).toBe('POST')
      const body = createHomeMutationSchema.parse(JSON.parse(String(init?.body)))
      expect(body).toMatchObject({ name: 'Hogar manual', addressId: null, newAddress: { ...selected, locationProof: proof } })
      expect(verifyLocationProof(body.newAddress!.locationProof!, body.newAddress!, secret)).toEqual(manual)
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
    fireEvent.change(screen.getByLabelText('Nombre del hogar'), { target: { value: 'Hogar manual' } })
    fireEvent.change(screen.getByLabelText('Tipo de lugar'), { target: { value: 'house' } })
    fillManual()
    await confirmedManual()
    fireEvent.click(screen.getByRole('button', { name: 'Crear hogar' }))
    await waitFor(() => expect(screen.getByLabelText('Hogar actual')).toHaveProperty('value', homeId))
    expect(create).toHaveBeenCalledTimes(1)
  })
})
