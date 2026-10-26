import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { ArgentineAddressFields } from '@/components/location/argentine-address-fields'

const suggestion = { kind: 'address', id: 'pavon-caba', label: 'AV PAVON 2012', secondary: 'San Cristóbal · CABA · Argentina',
  street: 'AV PAVON', number: '2012', city: 'San Cristóbal', cityId: '02021010', province: 'CABA', provinceId: '02', streetId: '0202101000123' }
const address = { street: 'AV PAVON', number: '2012', city: 'San Cristóbal', province: 'CABA', provinceId: '02', cityId: '02021010', streetId: '0202101000123',
  formattedAddress: 'AV PAVON 2012, San Cristóbal, CABA, Argentina', source: 'georef', precision: 'range_interpolated', latitude: -34.623, longitude: -58.397 }
afterEach(() => vi.unstubAllGlobals())
function Harness() {
  const [value, setValue] = useState({ street: '', number: '', city: '', province: '' })
  const [proof, setProof] = useState('')
  return <form onSubmit={event => event.preventDefault()}>
    <ArgentineAddressFields value={value} onChange={setValue} onProofChange={setProof} idPrefix="province-first"
      labels={{ street: 'Calle', number: 'Altura', city: 'Localidad', province: 'Provincia' }} />
    <output data-testid="result">{JSON.stringify({ ...value, proof })}</output>
    <button type="submit" disabled={!proof}>Guardar domicilio</button>
  </form>
}
function selectProvince(id = '02') { fireEvent.change(screen.getByRole('combobox', { name: 'Provincia' }), { target: { value: id } }) }
function query(value = 'Pavon 2012') { fireEvent.change(screen.getByRole('combobox', { name: 'Dirección' }), { target: { value } }) }
function result() { return JSON.parse(screen.getByTestId('result').textContent!) }
function setup(resolve: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response> = async (url) => String(url).includes('/suggestions')
  ? Response.json({ suggestions: [suggestion] }) : Response.json({ address, proof: 'verified-proof' })) {
  const fetcher = vi.fn(resolve); vi.stubGlobal('fetch', fetcher); render(<Harness />); return fetcher
}
it('requires an Argentine province above the disabled address before searching', () => {
  const fetcher = setup()
  const province = screen.getByRole('combobox', { name: 'Provincia' }) as HTMLSelectElement
  const direction = screen.getByRole('combobox', { name: 'Dirección' }) as HTMLInputElement
  expect(province.required).toBe(true)
  expect(province.value).toBe('')
  expect(province.compareDocumentPosition(direction) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(direction.disabled).toBe(true)
  expect(fetcher).not.toHaveBeenCalled()
  expect((screen.getByRole('button', { name: 'Guardar domicilio' }) as HTMLButtonElement).disabled).toBe(true)
})
it('offers 23 Argentine provinces and CABA separately', () => {
  setup()
  const selector = screen.getByRole('combobox', { name: 'Provincia' }) as HTMLSelectElement
  expect(selector.options).toHaveLength(25)
  expect([...selector.options].map(option => option.textContent)).toEqual(expect.arrayContaining(['Buenos Aires', 'Córdoba', 'Santa Fe', 'Ciudad Autónoma de Buenos Aires (CABA)']))
  expect([...selector.options].map(option => option.value)).toEqual(expect.arrayContaining(['02', '06', '14', '82']))
})
it('keeps the chosen province while typing and sends it on every search', async () => {
  const fetcher = setup(); selectProvince('06'); query('Pavon 2012, Córdoba')
  await waitFor(() => expect(fetcher).toHaveBeenCalled())
  const params = new URL(String(fetcher.mock.calls[0][0]), 'https://lysto.test').searchParams
  expect(params.get('provinceId')).toBe('06'); expect(params.get('province')).toBe('Buenos Aires')
  expect(result()).toMatchObject({ province: 'Buenos Aires', number: '', city: '', proof: '' })
})
it('confirms a selected address with the canonical fields and proof', async () => {
  setup(); selectProvince(); query()
  fireEvent.click(await screen.findByRole('option', { name: /AV PAVON 2012/ }))
  await waitFor(() => expect(result()).toMatchObject({ street: address.street, number: '2012', city: address.city, province: 'CABA', proof: 'verified-proof' }))
  expect((screen.getByRole('button', { name: 'Guardar domicilio' }) as HTMLButtonElement).disabled).toBe(false)
})
it('clears the entire selection and proof when the province changes', async () => {
  setup(); selectProvince(); query(); fireEvent.click(await screen.findByRole('option', { name: /AV PAVON 2012/ }))
  await waitFor(() => expect(result().proof).toBe('verified-proof'))
  selectProvince('82')
  expect(result()).toEqual({ street: '', number: '', city: '', province: 'Santa Fe', proof: '' })
  expect((screen.getByRole('combobox', { name: 'Dirección' }) as HTMLInputElement).value).toBe('')
  expect((screen.getByRole('button', { name: 'Guardar domicilio' }) as HTMLButtonElement).disabled).toBe(true)
})
it.each([200, 503])('does not offer a manual bypass after an empty or failed search (%s)', async status => {
  setup(async () => Response.json({ suggestions: [] }, { status })); selectProvince(); query('No existe 99999')
  await screen.findByText(status === 200 ? 'No encontramos coincidencias.' : 'No pudimos cargar opciones. Intentá nuevamente.')
  expect(screen.queryByRole('button', { name: 'Mi dirección no aparece' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Usar esta dirección' })).toBeNull()
  expect(result().proof).toBe('')
  expect((screen.getByRole('combobox', { name: 'Dirección' }) as HTMLInputElement).value).toBe('No existe 99999')
  expect((screen.getByRole('button', { name: 'Guardar domicilio' }) as HTMLButtonElement).disabled).toBe(true)
})
it('discards resolution from the previous province even if the request ignores abort', async () => {
  let finish!: (value: Response) => void
  setup(async url => String(url).includes('/suggestions') ? Response.json({ suggestions: [suggestion] }) : new Promise<Response>(resolve => { finish = resolve }))
  selectProvince(); query(); fireEvent.click(await screen.findByRole('option', { name: /AV PAVON 2012/ }))
  await waitFor(() => expect(finish).toBeTypeOf('function')); selectProvince('14')
  await act(async () => { finish(Response.json({ address, proof: 'stale-proof' })); await Promise.resolve() })
  expect(result()).toEqual({ street: '', number: '', city: '', province: 'Córdoba', proof: '' })
})
it('rejects a response from a province other than the selected one', async () => {
  setup(async url => String(url).includes('/suggestions') ? Response.json({ suggestions: [suggestion] })
    : Response.json({ address: { ...address, province: 'Buenos Aires', provinceId: '06' }, proof: 'wrong-province-proof' }))
  selectProvince(); query(); fireEvent.click(await screen.findByRole('option', { name: /AV PAVON 2012/ }))
  await screen.findByRole('alert'); expect(result().proof).toBe('')
})
it('does not accept a legacy manual response as a verified selection', async () => {
  setup(async url => String(url).includes('/suggestions') ? Response.json({ suggestions: [suggestion] })
    : Response.json({ address: { ...address, source: 'manual', precision: 'unverified', latitude: null, longitude: null }, proof: 'legacy-manual-proof' }))
  selectProvince(); query(); fireEvent.click(await screen.findByRole('option', { name: /AV PAVON 2012/ }))
  await screen.findByRole('alert'); expect(result().proof).toBe('')
})
