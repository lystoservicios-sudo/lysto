import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ArgentineAddressFields } from '@/components/location/argentine-address-fields'
import { FullAddressCombobox } from '@/components/location/full-address-combobox'

const json = (value: unknown) => Promise.resolve(new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } }))

afterEach(() => vi.unstubAllGlobals())

it.each(['fields', 'full'] as const)('shows a retryable resolution failure in %s without confirming an address', async (mode) => {
  const confirmed = vi.fn()
  const suggestion = { kind: 'address', id: 'address', label: 'Corrientes 123, CABA', street: 'Corrientes', number: '123', city: 'CABA', province: 'CABA' }
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => String(input).includes('/suggestions')
    ? json({ suggestions: [suggestion] })
    : Promise.resolve(new Response('{}', { status: 503 }))))
  function Harness() {
    const [value, setValue] = useState('')
    return mode === 'full'
      ? <FullAddressCombobox id="failure" label="Dirección" value={value} onChange={setValue} onResolved={confirmed} />
      : <AddressHarness confirmed={confirmed} />
  }
  render(<Harness />)
  fireEvent.change(screen.getByLabelText(mode === 'full' ? 'Dirección' : 'Altura'), { target: { value: mode === 'full' ? 'Corrientes 123' : '123' } })
  fireEvent.click(await screen.findByRole('option', { name: suggestion.label }))
  expect((await screen.findByRole('alert')).textContent).toContain('No pudimos confirmar la dirección')
  expect(confirmed.mock.calls.every(([proof]) => proof === '')).toBe(true)
})

function AddressHarness({ confirmed = vi.fn() }: { confirmed?: (proof: string) => void }) {
  const [value, setValue] = useState({ street: '', number: '', city: '', province: '' })
  return <ArgentineAddressFields value={value} onChange={setValue} onProofChange={confirmed}
    labels={{ street: 'Calle', number: 'Altura', city: 'Localidad', province: 'Provincia' }} idPrefix="test-address" />
}

describe('Argentina address fields', () => {
  it('keeps the supplied form labels and confirms a tapped complete address', async () => {
    const confirmed = vi.fn()
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('kind=province')) return json({ suggestions: [{ kind: 'province', id: '06', label: 'Buenos Aires', provinceId: '06', province: 'Buenos Aires' }] })
      if (url.includes('kind=city')) return json({ suggestions: [{ kind: 'city', id: '0665801007', label: 'Quilmes Oeste', provinceId: '06', province: 'Buenos Aires', cityId: '0665801007', city: 'Quilmes Oeste' }] })
      if (url.includes('kind=street')) return json({ suggestions: [{ kind: 'street', id: '066580100704335', label: 'GRL BELGRANO', provinceId: '06', province: 'Buenos Aires', cityId: '0665801007', city: 'Quilmes Oeste', streetId: '066580100704335', street: 'GRL BELGRANO' }] })
      if (url.includes('kind=address')) return json({ suggestions: [{ kind: 'address', id: 'address-1', label: 'GRL BELGRANO 123, Quilmes Oeste, Buenos Aires', provinceId: '06', province: 'Buenos Aires', cityId: '0665801007', city: 'Quilmes Oeste', streetId: '066580100704335', street: 'GRL BELGRANO', number: '123' }] })
      if (url.endsWith('/api/location/resolve') && init?.method === 'POST') return json({ address: { street: 'GRL BELGRANO', number: '123', city: 'Quilmes Oeste', province: 'Buenos Aires', provinceId: '06', cityId: '0665801007', streetId: '066580100704335', formattedAddress: 'GRL BELGRANO 123, Quilmes Oeste, Buenos Aires', latitude: -34.7, longitude: -58.3, precision: 'rooftop', source: 'georef_google' }, proof: 'proof-123' })
      throw new Error(`Unexpected request ${url}`)
    })
    vi.stubGlobal('fetch', fetcher)
    render(<AddressHarness confirmed={confirmed} />)

    expect(screen.getByLabelText('Calle')).toBeTruthy()
    expect(screen.getByLabelText('Altura')).toBeTruthy()
    expect(screen.getByLabelText('Localidad')).toBeTruthy()
    expect(screen.getByLabelText('Provincia')).toBeTruthy()
    expect(screen.queryByText(/buscá tu dirección/i)).toBeNull()

    fireEvent.change(screen.getByLabelText('Provincia'), { target: { value: 'Buenos' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Buenos Aires' }))
    fireEvent.change(screen.getByLabelText('Localidad'), { target: { value: 'Quil' } })
    fireEvent.click(await screen.findByRole('option', { name: /Quilmes Oeste/ }))
    fireEvent.change(screen.getByLabelText('Calle'), { target: { value: 'Belgrano' } })
    fireEvent.click(await screen.findByRole('option', { name: /GRL BELGRANO/ }))
    fireEvent.change(screen.getByLabelText('Altura'), { target: { value: '123' } })
    fireEvent.click(await screen.findByRole('option', { name: /GRL BELGRANO 123/ }))

    await waitFor(() => expect(confirmed).toHaveBeenLastCalledWith('proof-123'))
    expect(screen.getByLabelText('Calle')).toHaveProperty('value', 'GRL BELGRANO')
    expect(screen.getByLabelText('Localidad')).toHaveProperty('value', 'Quilmes Oeste')
  })

  it('invalidates confirmation after a confirmed geographic value changes', async () => {
    const confirmed = vi.fn()
    render(<AddressHarness confirmed={confirmed} />)
    fireEvent.change(screen.getByLabelText('Provincia'), { target: { value: 'Otra' } })
    expect(confirmed).toHaveBeenLastCalledWith('')
  })

  it('preserves the requested field order and placeholders', () => {
    render(<ArgentineAddressFields value={{ street: '', number: '', city: '', province: '' }} onChange={vi.fn()}
      labels={{ street: 'Calle', number: 'Altura', city: 'Localidad', province: 'Provincia' }} idPrefix="ordered"
      order={['street', 'number', 'city', 'province']} placeholders={{ street: 'Nombre de la calle', number: 'Número', city: 'Tu localidad', province: 'Tu provincia' }} />)
    const fields = screen.getAllByRole('combobox')
    expect(fields.map(field => field.getAttribute('aria-label') ?? field.getAttribute('id'))).toEqual(['ordered-street', 'ordered-number', 'ordered-city', 'ordered-province'])
    expect(screen.getByLabelText('Calle').getAttribute('placeholder')).toBe('Nombre de la calle')
    expect(screen.getByLabelText('Provincia').getAttribute('placeholder')).toBe('Tu provincia')
  })
})

describe('technician full address field', () => {
  it('does not replace a newer search with delayed options from the previous query', async () => {
    let finishOld!: (response: Response) => void
    const option = (city: string) => ({ kind: 'address', id: city, label: `PAVON 2012, ${city}`, street: 'PAVON', number: '2012', city, province: 'Buenos Aires' })
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => String(input).includes('Merlo')
      ? json({ suggestions: [option('Merlo')] })
      : new Promise<Response>(resolve => { finishOld = resolve })))
    function Harness() {
      const [value, setValue] = useState('')
      return <FullAddressCombobox id="latest-options" label="Dirección" value={value} onChange={setValue} onResolved={vi.fn()} />
    }
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Pavon 2012' } })
    await waitFor(() => expect(finishOld).toBeTypeOf('function'))
    fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Pavon 2012, Merlo' } })
    expect(await screen.findByRole('option', { name: 'PAVON 2012, Merlo' })).toBeTruthy()
    finishOld(new Response(JSON.stringify({ suggestions: [option('El Talar')] })))
    await waitFor(() => expect(screen.queryByRole('option', { name: 'PAVON 2012, El Talar' })).toBeNull())
    expect(screen.getByRole('option', { name: 'PAVON 2012, Merlo' })).toBeTruthy()
  })

  it('shows street and geographic context separately and resolves the city the user chooses', async () => {
    const resolved = vi.fn()
    const options = [
      { kind: 'address', id: 'pavon-caba', label: 'AV PAVON 2012', secondary: 'San Cristóbal · CABA · Argentina', street: 'AV PAVON', number: '2012', city: 'San Cristóbal', cityId: '02021010', province: 'CABA', provinceId: '02' },
      { kind: 'address', id: 'pavon-merlo', label: 'PAVON 2012', secondary: 'Merlo · Buenos Aires · Argentina', street: 'PAVON', number: '2012', city: 'Merlo', cityId: '06539010', province: 'Buenos Aires', provinceId: '06' }
    ]
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => String(input).includes('/suggestions')
      ? json({ suggestions: options })
      : json({ address: { ...JSON.parse(String(init?.body)), formattedAddress: 'PAVON 2012, Merlo, Buenos Aires' }, proof: 'merlo-proof' }))
    vi.stubGlobal('fetch', fetcher)
    function Harness() {
      const [value, setValue] = useState('')
      return <FullAddressCombobox id="choices" label="Dirección" value={value} onChange={setValue} onResolved={resolved} />
    }
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Pavon 2012' } })
    const merlo = await screen.findByRole('option', { name: 'PAVON 2012 Merlo · Buenos Aires · Argentina' })
    expect(within(merlo).getByText('PAVON 2012').tagName).toBe('STRONG')
    expect(screen.getByRole('option', { name: 'AV PAVON 2012 San Cristóbal · CABA · Argentina' })).toBeTruthy()
    fireEvent.click(merlo)
    await waitFor(() => expect(resolved).toHaveBeenCalledWith(expect.objectContaining({ proof: 'merlo-proof' })))
    const saved = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(saved?.[1]?.body))).toMatchObject({ street: 'PAVON', cityId: '06539010', provinceId: '06' })
  })

  it('explains the current coverage when a national result is outside the service area', async () => {
    const resolved = vi.fn()
    const fetcher = vi.fn(() => json({ suggestions: [{ kind: 'address', id: 'cordoba', label: 'PAVON 2012, Toledo, Córdoba', street: 'PAVON', number: '2012', city: 'Toledo', province: 'Córdoba', provinceId: '14' }] }))
    vi.stubGlobal('fetch', fetcher)
    render(<FullAddressCombobox id="coverage" label="Dirección" value="Pavon 2012" onChange={vi.fn()} onResolved={resolved} />)
    fireEvent.click(screen.getByLabelText('Dirección'))
    fireEvent.click(await screen.findByRole('option', { name: 'PAVON 2012, Toledo, Córdoba' }))
    expect((await screen.findByRole('alert')).textContent).toContain('CABA y la provincia de Buenos Aires')
    expect(fetcher.mock.calls).toHaveLength(1)
    expect(resolved).not.toHaveBeenCalled()
  })

  it('keeps the Dirección label and returns the canonical address and proof', async () => {
    const resolved = vi.fn()
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/suggestions')) return json({ suggestions: [{ kind: 'address', id: 'address-1', label: 'AV RIVADAVIA 1234, San Nicolás, CABA', provinceId: '02', province: 'Ciudad Autónoma de Buenos Aires', cityId: '02007010', city: 'San Nicolás', streetId: '0200701000085', street: 'AV RIVADAVIA', number: '1234' }] })
      if (init?.method === 'POST') return json({ address: { street: 'AV RIVADAVIA', number: '1234', city: 'San Nicolás', province: 'CABA', provinceId: '02', cityId: '02007010', streetId: '0200701000085', formattedAddress: 'Av. Rivadavia 1234, CABA, Argentina', latitude: -34.6, longitude: -58.4, precision: 'rooftop', source: 'georef_google' }, proof: 'pro-proof' })
      throw new Error('Unexpected request')
    }))
    function Harness() {
      const [value, setValue] = useState('')
      return <FullAddressCombobox id="pro-address" label="Dirección" value={value} onChange={setValue} onResolved={resolved} />
    }
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Rivadavia 1234' } })
    fireEvent.click(await screen.findByRole('option', { name: /AV RIVADAVIA 1234/ }))
    await waitFor(() => expect(resolved).toHaveBeenCalledWith(expect.objectContaining({ proof: 'pro-proof', value: 'Av. Rivadavia 1234, CABA, Argentina' })))
  })

  it('does not restore a resolved address after the user typed a newer value', async () => {
    let finishResolve!: (response: Response) => void
    const resolved = vi.fn()
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/suggestions')) return json({ suggestions: [{ kind: 'address', id: 'address-1', label: 'AV RIVADAVIA 1234, CABA', provinceId: '02', province: 'CABA', cityId: '02007010', city: 'San Nicolás', streetId: '0200701000085', street: 'AV RIVADAVIA', number: '1234' }] })
      if (init?.method === 'POST') return new Promise<Response>(resolve => { finishResolve = resolve })
      throw new Error('Unexpected request')
    }))
    function Harness() {
      const [value, setValue] = useState('')
      return <FullAddressCombobox id="stale-address" label="Dirección" value={value} onChange={setValue} onResolved={resolved} />
    }
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Rivadavia 1234' } })
    fireEvent.click(await screen.findByRole('option', { name: /AV RIVADAVIA 1234/ }))
    await waitFor(() => expect(finishResolve).toBeTypeOf('function'))
    fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Otra dirección' } })
    finishResolve(new Response(JSON.stringify({ address: { street: 'AV RIVADAVIA', number: '1234', city: 'San Nicolás', province: 'CABA', provinceId: '02', cityId: '02007010', streetId: '0200701000085', formattedAddress: 'Av. Rivadavia 1234, CABA, Argentina', latitude: -34.6, longitude: -58.4, precision: 'rooftop', source: 'georef_google' }, proof: 'old-proof' }), { status: 200 }))
    await Promise.resolve()
    expect(resolved).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Dirección') as HTMLInputElement).value).toBe('Otra dirección')
  })

  it('discards a resolution when the parent switches to another record', async () => {
    let finishResolve!: (response: Response) => void
    const resolved = vi.fn()
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/suggestions')) return json({ suggestions: [{ kind: 'address', id: 'address-1', label: 'AV RIVADAVIA 1234, CABA', provinceId: '02', province: 'CABA', cityId: '02007010', city: 'San Nicolás', streetId: '0200701000085', street: 'AV RIVADAVIA', number: '1234' }] })
      if (init?.method === 'POST') return new Promise<Response>(resolve => { finishResolve = resolve })
      throw new Error('Unexpected request')
    }))
    const { rerender } = render(<FullAddressCombobox id="record-address" label="Dirección" value="Rivadavia 1234" revisionKey="first" onChange={vi.fn()} onResolved={resolved} />)
    fireEvent.click(screen.getByLabelText('Dirección'))
    fireEvent.click(await screen.findByRole('option', { name: /AV RIVADAVIA 1234/ }))
    await waitFor(() => expect(finishResolve).toBeTypeOf('function'))
    rerender(<FullAddressCombobox id="record-address" label="Dirección" value="Otra dirección" revisionKey="second" onChange={vi.fn()} onResolved={resolved} />)
    finishResolve(new Response(JSON.stringify({ address: { street: 'AV RIVADAVIA', number: '1234', city: 'San Nicolás', province: 'CABA', provinceId: '02', cityId: '02007010', streetId: '0200701000085', formattedAddress: 'Av. Rivadavia 1234, CABA, Argentina', latitude: -34.6, longitude: -58.4, precision: 'rooftop', source: 'georef_google' }, proof: 'old-proof' }), { status: 200 }))
    await Promise.resolve()
    expect(resolved).not.toHaveBeenCalled()
  })
})
