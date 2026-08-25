import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CustomerAddressForm } from '@/components/customer/customer-address-form'
import { CustomerProfileForm } from '@/components/customer/customer-profile-form'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'

afterEach(() => cleanup())

describe('customer account forms', () => {
  it('keeps profile saving unavailable when no persistence callback exists', () => {
    render(<CustomerProfileForm initialValue={customerDemoFixtures.profile} />)

    const firstName = screen.getByRole('textbox', { name: 'Nombre' })
    fireEvent.change(firstName, { target: { value: 'Marina Elena' } })

    expect(screen.getByText('Tenés cambios sin guardar')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('El guardado del perfil se conectará cuando esté disponible la persistencia.')).toBeTruthy()
  })

  it('exposes invalid profile fields accessibly', () => {
    render(<CustomerProfileForm initialValue={customerDemoFixtures.profile} onSubmit={vi.fn()} />)

    const email = screen.getByRole('textbox', { name: 'Email' })
    fireEvent.change(email, { target: { value: 'correo-invalido' } })

    expect(email.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Ingresá un email válido.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('announces pending and success only after a connected operation confirms it', async () => {
    let resolveSubmission: ((value: { ok: true; message: string }) => void) | undefined
    const onSubmit = vi.fn(() => new Promise<{ ok: true; message: string }>((resolve) => {
      resolveSubmission = resolve
    }))
    render(<CustomerProfileForm initialValue={customerDemoFixtures.profile} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre' }), { target: { value: 'Marina Elena' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect((await screen.findByRole('status')).textContent).toContain('Guardando cambios')
    expect((screen.getByRole('button', { name: 'Guardando' }) as HTMLButtonElement).disabled).toBe(true)
    resolveSubmission?.({ ok: true, message: 'Perfil actualizado' })
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Perfil actualizado'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('announces an operation failure without clearing the edited profile', async () => {
    const onSubmit = vi.fn(async () => ({ ok: false, message: 'El perfil no pudo actualizarse' }))
    render(<CustomerProfileForm initialValue={customerDemoFixtures.profile} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre' }), { target: { value: 'Marina Elena' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('El perfil no pudo actualizarse'))
    expect((screen.getByRole('textbox', { name: 'Nombre' }) as HTMLInputElement).value).toBe('Marina Elena')
  })

  it('models address access as structured controls and blocks invalid submissions', () => {
    const onSubmit = vi.fn()
    render(<CustomerAddressForm initialValue={customerDemoFixtures.addresses[0]} onSubmit={onSubmit} />)

    const elevator = screen.getByRole('checkbox', { name: 'Hay ascensor' }) as HTMLInputElement
    fireEvent.click(elevator)
    expect(elevator.checked).toBe(false)

    const street = screen.getByRole('textbox', { name: 'Calle' })
    fireEvent.change(street, { target: { value: '' } })
    expect(street.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Ingresá la calle.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Guardar dirección' }) as HTMLButtonElement).disabled).toBe(true)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('keeps address saving unavailable without pretending to create a record', () => {
    render(<CustomerAddressForm initialValue={customerDemoFixtures.addresses[0]} />)

    expect((screen.getByRole('button', { name: 'Guardar dirección' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('El guardado de direcciones se conectará cuando esté disponible la persistencia.')).toBeTruthy()
  })

  it('shows a connected address operation error instead of a false success', async () => {
    const onSubmit = vi.fn(async () => ({ ok: false, message: 'La dirección no pudo guardarse' }))
    render(<CustomerAddressForm initialValue={customerDemoFixtures.addresses[0]} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Ciudad' }), { target: { value: 'Rosario' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar dirección' }))

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('La dirección no pudo guardarse'))
  })
})
