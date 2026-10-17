import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CompleteProfileForm } from '@/components/auth/customer-forms'
import { ConnectedCustomerAddresses } from '@/components/customer/connected-customer-addresses'
import { HomeForm, configuration } from '@/components/customer/hogar/hogar-forms'
import { RequestLocationStep } from '@/features/service-request/request-location-step'

const emptyPage = { items: [], total: 0, nextCursor: null }
afterEach(() => vi.unstubAllGlobals())

describe('customer location entry points', () => {
  it('keeps the profile-completion labels and carries a location proof field', () => {
    render(<CompleteProfileForm missing={['street', 'number', 'city', 'province', 'property_type']} next="/app" address={null} />)
    expect(screen.getByRole('combobox', { name: 'Calle' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Altura' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Localidad' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Provincia' })).toBeTruthy()
    expect(document.querySelector('input[name="location_proof"]')).toBeTruthy()
  })

  it('uses the same selectable fields in Más and Hogar without changing their labels', () => {
    const { unmount } = render(<ConnectedCustomerAddresses initialPage={emptyPage} />)
    expect(screen.getByRole('combobox', { name: 'Calle *' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Número *' })).toBeTruthy()
    unmount()
    render(<HomeForm flow={{ type: 'home', value: configuration(), key: 'key', existing: false }} addresses={[]} homes={[]} busy={false} locked={false} onChange={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Calle' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Número' })).toBeTruthy()
  })

  it('uses the shared selectable address inside Pedir', () => {
    render(<RequestLocationStep customerId="00000000-0000-4000-8000-000000000001" data={{ homes: [], addresses: [], equipment: [] }} equipmentId={null} selection={null} onData={vi.fn()} onEquipmentCreated={vi.fn()} onSelect={vi.fn()} onLock={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Añadir hogar' }))
    expect(screen.getByRole('combobox', { name: 'Calle' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Número' })).toBeTruthy()
  })

  it('explains an unconfirmed new address in Más before attempting persistence', () => {
    const { container } = render(<ConnectedCustomerAddresses initialPage={emptyPage} />)
    fireEvent.change(screen.getByLabelText(/Nombre de la dirección/), { target: { value: 'Casa' } })
    for (const [name, value] of [['Calle *', 'Corrientes'], ['Número *', '1234'], ['Ciudad *', 'CABA'], ['Provincia *', 'CABA']])
      fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
    fireEvent.submit(container.querySelector('form')!)
    expect(screen.getByRole('alert').textContent).toContain('Elegí una dirección de las opciones')
  })

  it('preserves editing a saved address label without requiring another location lookup', async () => {
    const address = { id: '20000000-0000-4000-8000-000000000003', version: 1, createdAt: '2026-10-17', archivedAt: null,
      label: 'Casa', street: 'Corrientes', number: '1234', city: 'CABA', province: 'CABA', propertyType: 'house' as const, isDefault: true, access: {} }
    const updated = { ...address, label: 'Casa principal', version: 2 }
    const fetcher = vi.fn(async (_input: RequestInfo | URL, options?: RequestInit) => new Response(JSON.stringify(
      options?.method === 'PUT' ? { address: updated } : { items: [updated], total: 1, nextCursor: null }
    )))
    vi.stubGlobal('fetch', fetcher)
    const { container } = render(<ConnectedCustomerAddresses initialPage={{ items: [address], total: 1, nextCursor: null }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar Casa' }))
    fireEvent.change(screen.getByLabelText(/Nombre de la dirección/), { target: { value: updated.label } })
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({ id: address.id, expectedVersion: 1, label: updated.label, locationProof: '' })
    expect(screen.getByText('La dirección quedó guardada.')).toBeTruthy()
  })

  it('explains an unconfirmed new home address before attempting persistence', () => {
    const save = vi.fn()
    const { container } = render(<HomeForm flow={{ type: 'home', value: { ...configuration(), name: 'Casa' }, key: 'key', existing: false }} addresses={[]} homes={[]} busy={false} locked={false} onChange={vi.fn()} onSave={save} onCancel={vi.fn()} />)
    for (const [name, value] of [['Calle', 'Corrientes'], ['Número', '1234'], ['Ciudad', 'CABA'], ['Provincia', 'CABA']]) {
      fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
    }
    fireEvent.submit(container.querySelector('form')!)
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('Elegí una dirección de las opciones')
  })
})
