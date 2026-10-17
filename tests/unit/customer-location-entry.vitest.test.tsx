import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CompleteProfileForm } from '@/components/auth/customer-forms'
import { ConnectedCustomerAddresses } from '@/components/customer/connected-customer-addresses'
import { HomeForm, configuration } from '@/components/customer/hogar/hogar-forms'
import { RequestLocationStep } from '@/features/service-request/request-location-step'

const emptyPage = { items: [], total: 0, nextCursor: null }

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
