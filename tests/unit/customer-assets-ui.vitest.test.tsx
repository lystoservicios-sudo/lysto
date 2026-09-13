import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConnectedCustomerProfile } from '@/components/customer/connected-customer-profile'

const initial = {
  id: 'c160f1d9-c23a-4687-b3a3-13122479a55e',
  firstName: 'Cliente',
  lastName: 'Prueba',
  email: 'cliente@lysto.test',
  phone: '1155551234',
  notificationPreference: 'email' as const,
  version: 4
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe('persisted profile feedback', () => {
  it('keeps unsaved edits and never announces success when the connection fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network failed')))
    render(<ConnectedCustomerProfile initialValue={initial} />)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Cambio sin guardar' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByRole('alert')
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Cambio sin guardar')
    expect(screen.queryByText('Tus cambios quedaron guardados.')).toBeNull()
  })
  it('sends only editable fields and uses the canonical saved version', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ profile: { ...initial, firstName: 'Nuevo', version: 5 } }), {
          status: 200
        })
      )
    vi.stubGlobal('fetch', fetcher)
    render(<ConnectedCustomerProfile initialValue={initial} />)
    expect((screen.getByRole('textbox', { name: 'Email' }) as HTMLInputElement).readOnly).toBe(true)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nuevo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Tus cambios quedaron guardados.')
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      firstName: 'Nuevo',
      lastName: 'Prueba',
      phone: '1155551234',
      notificationPreference: 'email',
      expectedVersion: 4
    })
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement).disabled
      ).toBe(true)
    )
  })
  it('explains a conflicting version and retains the draft until an explicit reload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 409 })))
    render(<ConnectedCustomerProfile initialValue={initial} />)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Mi edición' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Los datos cambiaron')
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Mi edición')
  })
})
