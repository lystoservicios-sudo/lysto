import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { ArgentineAddressFields } from '@/components/location/argentine-address-fields'
import { CompleteProfileForm } from '@/components/auth/customer-forms'

const address = { street: 'PAVON', number: '2012', city: 'Merlo', province: 'Buenos Aires', provinceId: '06', cityId: '06539010', streetId: 'pavon', formattedAddress: 'PAVON 2012, Merlo, Buenos Aires', latitude: -34.66, longitude: -58.72, source: 'georef', precision: 'range_interpolated' }
const suggestion = { street: address.street, number: address.number, city: address.city, province: address.province, provinceId: address.provinceId, cityId: address.cityId, streetId: address.streetId, kind: 'address', id: 'merlo', label: 'PAVON 2012' }
function provider() {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => Response.json(String(input).includes('/suggestions')
    ? { suggestions: [{ ...suggestion, secondary: 'Merlo · Buenos Aires · Argentina' }] }
    : { address, proof: 'confirmed-merlo' }))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
async function chooseAddress() {
  fireEvent.change(screen.getByRole('combobox', { name: 'Provincia' }), { target: { value: '06' } }); fireEvent.change(screen.getByRole('combobox', { name: 'Dirección' }), { target: { value: 'Pavon 2012' } })
  fireEvent.click(await screen.findByRole('option', { name: 'PAVON 2012 Merlo · Buenos Aires · Argentina' }))
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Dirección' })).toHaveProperty('value', address.formattedAddress))
}
afterEach(() => vi.unstubAllGlobals())

it('explains why profile completion cannot submit an unselected address', () => {
  const { container } = render(<CompleteProfileForm missing={['street', 'number', 'city', 'province']} next="/app" address={null} />)
  fireEvent.change(screen.getByRole('combobox', { name: 'Provincia' }), { target: { value: '06' } }); fireEvent.change(screen.getByRole('combobox', { name: 'Dirección' }), { target: { value: 'Pavon 2012' } })
  fireEvent.submit(container.querySelector('form')!)
  expect(screen.getByRole('alert').textContent).toBe('Elegí la provincia y seleccioná una dirección de la lista para continuar.')
})

it('submits all canonical address fields and the proof from the existing profile-completion form', async () => {
  const fetcher = provider()
  const { container } = render(<CompleteProfileForm missing={['street', 'number', 'city', 'province']} next="/app" address={null} />)
  expect(screen.getAllByRole('combobox')).toHaveLength(2)
  await chooseAddress()
  const form = new FormData(container.querySelector('form')!)
  expect(Object.fromEntries(form)).toMatchObject({ street: 'PAVON', number: '2012', city: 'Merlo', province: 'Buenos Aires', location_proof: 'confirmed-merlo' })
  const resolution = fetcher.mock.calls.find(([input]) => String(input).endsWith('/resolve'))
  expect(resolution).toBeTruthy()
  fireEvent.change(screen.getByRole('combobox', { name: 'Dirección' }), { target: { value: 'Otra 123' } })
  expect(Object.fromEntries(new FormData(container.querySelector('form')!))).toMatchObject({ street: 'Otra 123', number: '', city: '', province: 'Buenos Aires', location_proof: '' })
})

it('keeps floor and apartment controls and their latest values while an address is resolving', async () => {
  let finish!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => String(input).includes('/suggestions')
    ? Promise.resolve(Response.json({ suggestions: [suggestion] }))
    : new Promise<Response>(resolve => { finish = resolve })))
  function Harness() {
    const [value, setValue] = useState({ street: '', number: '', city: '', province: '', floor: '1' })
    return <><ArgentineAddressFields value={value} onChange={location => setValue({ ...value, ...location })}
      labels={{ street: 'Calle', number: 'Número', city: 'Ciudad', province: 'Provincia' }} idPrefix="same-form"
      after={{ number: <label>Piso<input value={value.floor} onChange={event => setValue({ ...value, floor: event.target.value })} /></label> }} />
      <output data-testid="saved">{JSON.stringify(value)}</output></>
  }
  render(<Harness />)
  fireEvent.change(screen.getByRole('combobox', { name: 'Provincia' }), { target: { value: '06' } }); fireEvent.change(screen.getByRole('combobox', { name: 'Dirección' }), { target: { value: 'Pavon 2012' } })
  fireEvent.click(await screen.findByRole('option', { name: 'PAVON 2012' }))
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  fireEvent.change(screen.getByLabelText('Piso'), { target: { value: '8' } })
  finish(Response.json({ address, proof: 'confirmed-merlo' }))
  await waitFor(() => expect(JSON.parse(screen.getByTestId('saved').textContent!)).toMatchObject({ street: 'PAVON', city: 'Merlo', floor: '8' }))
})
