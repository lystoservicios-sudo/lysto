import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { ArgentineAddressFields } from '@/components/location/argentine-address-fields'
import { FullAddressCombobox } from '@/components/location/full-address-combobox'

const manual = { street: 'Calle del ejemplo', number: '1234', city: 'Quilmes', province: 'Buenos Aires',
  provinceId: '06', formattedAddress: 'Calle del ejemplo 1234, Quilmes, Buenos Aires, Argentina',
  source: 'manual', precision: 'unverified', latitude: null, longitude: null }
afterEach(() => vi.unstubAllGlobals())

function fillManual() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Calle' }), { target: { value: manual.street } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Altura' }), { target: { value: manual.number } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Localidad' }), { target: { value: manual.city } })
  fireEvent.change(screen.getByRole('combobox', { name: 'Provincia' }), { target: { value: manual.province } })
}
function Harness() {
  const [value, setValue] = useState({ street: '', number: '', city: '', province: '' })
  const [proof, setProof] = useState('')
  return <form onSubmit={event => event.preventDefault()}>
    <ArgentineAddressFields value={value} onChange={setValue} onProofChange={setProof} idPrefix="recovery"
      labels={{ street: 'Calle', number: 'Altura', city: 'Localidad', province: 'Provincia' }} />
    <output data-testid="result">{JSON.stringify({ ...value, proof })}</output>
    <button type="submit" disabled={!proof}>Guardar domicilio</button>
  </form>
}

it.each([200, 503])('offers manual entry when suggestions are empty or unavailable (%s)', async status => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ suggestions: [] }, { status })))
  render(<Harness />)
  fireEvent.change(screen.getByRole('combobox', { name: 'Dirección' }), { target: { value: 'Calle del ejemplo 1234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Mi dirección no aparece' }))
  expect(screen.getByRole('textbox', { name: 'Localidad' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Usar esta dirección' }).getAttribute('type')).toBe('button')
  expect(document.querySelectorAll('form')).toHaveLength(1)
})

it('saves typed address fields and its signed receipt without claiming a verified point', async () => {
  const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).includes('/suggestions')) return Response.json({ suggestions: [] })
    expect(init?.method).toBe('POST')
    return Response.json({ address: manual, proof: 'manual-receipt' })
  })
  vi.stubGlobal('fetch', fetcher)
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Mi dirección no aparece' }))
  fillManual()
  fireEvent.click(screen.getByRole('button', { name: 'Usar esta dirección' }))
  await waitFor(() => expect(JSON.parse(screen.getByTestId('result').textContent!)).toMatchObject({
    street: manual.street, number: manual.number, city: manual.city, province: manual.province, proof: 'manual-receipt'
  }))
  expect((screen.getByRole('button', { name: 'Guardar domicilio' }) as HTMLButtonElement).disabled).toBe(false)
  expect(screen.getByText(/antes de calcular el traslado/)).toBeTruthy()
  const resolve = fetcher.mock.calls.find(([url]) => String(url).endsWith('/resolve'))
  expect(resolve).toBeTruthy()
  expect(JSON.parse(String(resolve?.[1]?.body))).toEqual({ mode: 'manual', street: manual.street, number: manual.number, city: manual.city, province: manual.province })
  fireEvent.change(screen.getByRole('combobox', { name: 'Dirección' }), { target: { value: 'Otra calle 555' } })
  expect(JSON.parse(screen.getByTestId('result').textContent!).proof).toBe('')
  expect((screen.getByRole('button', { name: 'Guardar domicilio' }) as HTMLButtonElement).disabled).toBe(true)
})

it('retains editable manual fields after a failed confirmation and permits retry', async () => {
  let attempts = 0
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => {
    if (String(url).includes('/suggestions')) return Response.json({ suggestions: [] })
    attempts++
    return attempts === 1 ? Response.json({}, { status: 503 }) : Response.json({ address: manual, proof: 'retry-proof' })
  }))
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Mi dirección no aparece' }))
  fillManual()
  fireEvent.click(screen.getByRole('button', { name: 'Usar esta dirección' }))
  await screen.findByRole('alert')
  expect((screen.getByRole('textbox', { name: 'Calle' }) as HTMLInputElement).value).toBe(manual.street)
  fireEvent.click(screen.getByRole('button', { name: 'Usar esta dirección' }))
  await waitFor(() => expect(JSON.parse(screen.getByTestId('result').textContent!).proof).toBe('retry-proof'))
  expect(attempts).toBe(2)
})

it('rejects incomplete manual fields without a request', () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Mi dirección no aparece' }))
  fireEvent.click(screen.getByRole('button', { name: 'Usar esta dirección' }))
  expect(screen.getByRole('alert').textContent).toContain('Completá')
  expect(fetcher).not.toHaveBeenCalled()
})

it.each([['Otra 500, Quilmes, Buenos Aires', 'Buenos Aires', 'Quilmes'], ['Otra 500, Provincia de Buenos Aires', 'Buenos Aires', ''], ['Cerrito 628, CABA', 'CABA', 'CABA'], ['Cerrito 628, Ciudad de Buenos Aires', 'CABA', 'CABA']])('uses explicit location instead of previous context (%s)', (query, province, city) => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ suggestions: [] })))
  function Existing() {
    const [value, setValue] = useState({ street: 'Corrientes', number: '1234', city: 'San Nicolás', province: 'CABA' })
    return <ArgentineAddressFields value={value} onChange={setValue} onProofChange={vi.fn()} idPrefix="existing"
      labels={{ street: 'Calle', number: 'Altura', city: 'Localidad', province: 'Provincia' }} />
  }
  render(<Existing />)
  fireEvent.change(screen.getByRole('combobox', { name: 'Dirección' }), { target: { value: query } })
  fireEvent.click(screen.getByRole('button', { name: 'Mi dirección no aparece' }))
  expect((screen.getByRole('combobox', { name: 'Provincia' }) as HTMLSelectElement).value).toBe(province)
  expect((screen.getByRole('textbox', { name: 'Localidad' }) as HTMLInputElement).value).toBe(city)
})

it('checks the full address length including the country before submitting', () => {
  const fetcher = vi.fn(async () => Response.json({ address: manual, proof: 'should-not-submit' }))
  vi.stubGlobal('fetch', fetcher)
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Mi dirección no aparece' }))
  fillManual()
  fireEvent.change(screen.getByRole('textbox', { name: 'Calle' }), { target: { value: 'S'.repeat(140) } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Localidad' }), { target: { value: 'Q'.repeat(30) } })
  fireEvent.click(screen.getByRole('button', { name: 'Usar esta dirección' }))
  expect(screen.getByRole('alert').textContent).toContain('demasiado larga')
  expect(fetcher).not.toHaveBeenCalled()
})

it('does not apply a delayed manual response after switching back to search and editing', async () => {
  let finish!: (response: Response) => void
  const resolved = vi.fn()
  vi.stubGlobal('fetch', vi.fn((url: RequestInfo | URL) => String(url).includes('/suggestions')
    ? Promise.resolve(Response.json({ suggestions: [] })) : new Promise<Response>(resolve => { finish = resolve })))
  function Direct() {
    const [value, setValue] = useState('')
    return <FullAddressCombobox id="stale-manual" label="Dirección" value={value} onChange={setValue} onResolved={resolved} />
  }
  render(<Direct />)
  fireEvent.click(screen.getByRole('button', { name: 'Mi dirección no aparece' }))
  fillManual()
  fireEvent.click(screen.getByRole('button', { name: 'Usar esta dirección' }))
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  fireEvent.click(screen.getByRole('button', { name: 'Volver al buscador' }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Dirección' }), { target: { value: 'Otra calle 555' } })
  await act(async () => { finish(Response.json({ address: manual, proof: 'stale-proof' })); await Promise.resolve() })
  expect(resolved).not.toHaveBeenCalled()
})

it('discards a pending manual confirmation when the parent changes the saved record version', async () => {
  let finish!: (response: Response) => void
  const resolved = vi.fn()
  vi.stubGlobal('fetch', vi.fn((url: RequestInfo | URL) => String(url).includes('/suggestions')
    ? Promise.resolve(Response.json({ suggestions: [] })) : new Promise<Response>(resolve => { finish = resolve })))
  const { rerender } = render(<FullAddressCombobox id="manual-version" label="Dirección" value="" revisionKey="pro:1"
    onChange={vi.fn()} onResolved={resolved} />)
  fireEvent.click(screen.getByRole('button', { name: 'Mi dirección no aparece' }))
  fillManual()
  fireEvent.click(screen.getByRole('button', { name: 'Usar esta dirección' }))
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  rerender(<FullAddressCombobox id="manual-version" label="Dirección" value="Otra 500, CABA" revisionKey="pro:2"
    onChange={vi.fn()} onResolved={resolved} />)
  await act(async () => { finish(Response.json({ address: manual, proof: 'old-version-proof' })); await Promise.resolve() })
  expect(resolved).not.toHaveBeenCalled()
  expect((screen.getByRole('textbox', { name: 'Calle' }) as HTMLInputElement).value).toBe('Otra')
})
