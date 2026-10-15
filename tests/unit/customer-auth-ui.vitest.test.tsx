import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const actions = vi.hoisted(() => ({ register: vi.fn(), complete: vi.fn() }))
vi.mock('../../app/(auth)/registro/actions', () => ({ registerAction: actions.register }))
vi.mock('../../app/(auth)/completar-cuenta/actions', () => ({ completeAccountAction: actions.complete }))

import { CompleteProfileForm } from '../../components/auth/customer-forms'
import { RegistrationForm } from '../../app/(auth)/registro/registration-form'
import { GENERIC_REGISTRATION_MESSAGE, type AccountResult } from '../../lib/auth/account-lifecycle'
import ResetPage from '../../app/(auth)/restablecer/page'
afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  actions.register.mockResolvedValue({ status: 'success', message: GENERIC_REGISTRATION_MESSAGE })
  actions.complete.mockResolvedValue({ status: 'idle', message: '' })
})
const policy = { termsVersion: 't1', privacyVersion: 'p1', termsUrl: 'https://lysto.test/terminos', privacyUrl: 'https://lysto.test/privacidad', testOnly: false }

function fillPersonalDetails() {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } })
  fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Pérez' } })
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '+54 11 5555 1234' } })
}

function continueToAccess() {
  fillPersonalDetails()
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
}

function fillAccessDetails() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.test' } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'segura123' } })
  fireEvent.change(screen.getByLabelText('Repetir contraseña'), { target: { value: 'segura123' } })
  fireEvent.click(screen.getByRole('checkbox'))
}

describe('customer account UI', () => {
  it('starts with personal information and does not register while continuing', () => {
    render(<RegistrationForm policy={policy} next="/app/hogar" />)

    expect(screen.getByRole('list', { name: 'Pasos para crear tu cuenta' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Tus datos' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Crear mi cuenta' })).toBeNull()

    continueToAccess()

    expect(screen.getByRole('heading', { name: 'Tu acceso' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Crear mi cuenta' })).toBeDefined()
    expect(actions.register).not.toHaveBeenCalled()
  })

  it('validates personal information before opening the access step', () => {
    render(<RegistrationForm policy={policy} />)
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByRole('heading', { name: 'Tus datos' })).toBeDefined()

    fillPersonalDetails()
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByRole('heading', { name: 'Tus datos' })).toBeDefined()
    expect(actions.register).not.toHaveBeenCalled()
  })

  it('keeps all entered information when returning between steps', () => {
    render(<RegistrationForm policy={policy} />)
    continueToAccess()
    fillAccessDetails()

    fireEvent.click(screen.getByRole('button', { name: 'Volver a tus datos' }))
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Ana')
    expect((screen.getByLabelText('Teléfono') as HTMLInputElement).value).toBe('+54 11 5555 1234')
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('ana@example.test')
    expect((screen.getByLabelText('Contraseña') as HTMLInputElement).value).toBe('segura123')
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
  })

  it('submits both steps and legal versions only once the complete form is valid', async () => {
    render(<RegistrationForm policy={policy} next="/app/hogar" />)
    continueToAccess()
    fillAccessDetails()
    fireEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }))

    await waitFor(() => expect(actions.register).toHaveBeenCalledTimes(1))
    const submitted = actions.register.mock.calls[0][1] as FormData
    expect(Object.fromEntries(submitted.entries())).toEqual({
      firstName: 'Ana', lastName: 'Pérez', phone: '+54 11 5555 1234',
      email: 'ana@example.test', password: 'segura123', repeatPassword: 'segura123',
      accepted: 'on', termsVersion: 't1', privacyVersion: 'p1', next: '/app/hogar'
    })
    expect(await screen.findByRole('heading', { name: 'Revisá tu correo' })).toBeDefined()
    expect(screen.getByRole('status').textContent).toBe(GENERIC_REGISTRATION_MESSAGE)
    expect(screen.getByRole('link', { name: 'Ir a iniciar sesión' }).getAttribute('href')).toBe('/login?next=%2Fapp%2Fhogar')
    expect(screen.queryByLabelText('Contraseña')).toBeNull()
  })

  it('does not submit without consent or matching passwords and allows correcting them', async () => {
    render(<RegistrationForm policy={policy} />)
    continueToAccess()
    fillAccessDetails()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }))
    expect(actions.register).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.change(screen.getByLabelText('Repetir contraseña'), { target: { value: 'otra123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }))
    expect(actions.register).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Repetir contraseña'), { target: { value: 'segura123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }))
    await waitFor(() => expect(actions.register).toHaveBeenCalledTimes(1))
  })

  it('prevents duplicate requests while keeping every step in the submitted payload', async () => {
    let finish!: (result: AccountResult) => void
    actions.register.mockReturnValueOnce(new Promise<AccountResult>(resolve => { finish = resolve }))
    const { container } = render(<RegistrationForm policy={policy} />)
    continueToAccess()
    fillAccessDetails()
    fireEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }))

    await waitFor(() => expect(actions.register).toHaveBeenCalledTimes(1))
    expect((screen.getByRole('button', { name: 'Procesando…' }) as HTMLButtonElement).disabled).toBe(true)
    const form = container.querySelector('form')!
    expect(new FormData(form).get('firstName')).toBe('Ana')
    expect(new FormData(form).get('password')).toBe('segura123')
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).disabled).toBe(false)
    fireEvent.submit(form)
    expect(actions.register).toHaveBeenCalledTimes(1)

    await act(async () => finish({ status: 'success', message: GENERIC_REGISTRATION_MESSAGE }))
    expect(screen.getByRole('heading', { name: 'Revisá tu correo' })).toBeDefined()
  })

  it('retains entered information after a server error and allows correcting it', async () => {
    actions.register.mockResolvedValueOnce({ status: 'error', message: 'No pudimos procesar la solicitud.' })
    render(<RegistrationForm policy={policy} />)
    continueToAccess()
    fillAccessDetails()
    fireEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }))

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'No pudimos procesar la solicitud.')
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('ana@example.test')
    expect((screen.getByLabelText('Contraseña') as HTMLInputElement).value).toBe('segura123')
    fireEvent.click(screen.getByRole('button', { name: 'Volver a tus datos' }))
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Ana')
  })

  it('completes an existing account without a registration stepper or password fields', () => {
    render(<RegistrationForm policy={policy} completing initialValues={{ firstName: 'Ana', lastName: 'Pérez', phone: '1155551234' }} />)
    expect(screen.queryByRole('list', { name: 'Pasos para crear tu cuenta' })).toBeNull()
    expect(screen.queryByLabelText('Email')).toBeNull()
    expect(screen.queryByLabelText('Contraseña')).toBeNull()
    expect(screen.getByRole('button', { name: 'Guardar y continuar' })).toBeDefined()
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Ana')
  })

  it('keeps the existing account-completion action and its full consent payload', async () => {
    render(<RegistrationForm policy={policy} completing next="/app/hogar" initialValues={{ firstName: 'Ana', lastName: 'Pérez', phone: '1155551234' }} />)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))

    await waitFor(() => expect(actions.complete).toHaveBeenCalledTimes(1))
    expect(actions.register).not.toHaveBeenCalled()
    expect(Object.fromEntries((actions.complete.mock.calls[0][1] as FormData).entries())).toEqual({
      firstName: 'Ana', lastName: 'Pérez', phone: '1155551234', accepted: 'on',
      termsVersion: 't1', privacyVersion: 'p1', next: '/app/hogar'
    })
  })

  it('requires explicit consent without role language', () => {
    const { container } = render(<RegistrationForm policy={policy} next="/app" />)
    continueToAccess()
    expect(screen.getByLabelText('Contraseña').getAttribute('minlength')).toBe('6')
    expect(screen.getByLabelText('Contraseña').getAttribute('maxlength')).toBe('12')
    expect(screen.getByLabelText('Repetir contraseña').getAttribute('minlength')).toBe('6')
    expect(screen.getByLabelText('Repetir contraseña').getAttribute('maxlength')).toBe('12')
    expect(screen.getByText('Usá entre 6 y 12 caracteres.')).toBeDefined()
    expect(screen.getByRole('checkbox').hasAttribute('required')).toBe(true)
    expect(screen.getByRole('button', { name: 'Crear mi cuenta' }).getAttribute('type')).toBe('submit')
    expect(container.textContent).not.toMatch(/cliente|técnico|admin|invitación/i)
  })
  it('reveals and hides each registration password independently', () => {
    render(<RegistrationForm policy={policy} next="/app" />)
    continueToAccess()
    const password = screen.getByLabelText('Contraseña') as HTMLInputElement
    const confirmation = screen.getByLabelText('Repetir contraseña') as HTMLInputElement

    expect(password.type).toBe('password')
    expect(confirmation.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(password.type).toBe('text')
    expect(confirmation.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(password.type).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar repetir contraseña' }))
    expect(password.type).toBe('password')
    expect(confirmation.type).toBe('text')
  })
  it('uses the customer password limits when resetting access', async () => {
    render(await ResetPage({ searchParams: Promise.resolve({ token_hash: 'a'.repeat(43) }) }))

    expect(screen.getByLabelText('Nueva contraseña').getAttribute('minlength')).toBe('6')
    expect(screen.getByLabelText('Nueva contraseña').getAttribute('maxlength')).toBe('12')
    expect(screen.getByLabelText('Repetir contraseña').getAttribute('minlength')).toBe('6')
    expect(screen.getByLabelText('Repetir contraseña').getAttribute('maxlength')).toBe('12')
    expect(screen.getByText('Usá entre 6 y 12 caracteres.')).toBeDefined()
  })
  it('shows only missing information with mobile-friendly phone input', () => {
    render(<CompleteProfileForm missing={['phone', 'property_type']} next="/app" />)
    expect(screen.getByLabelText('Teléfono').getAttribute('type')).toBe('tel')
    expect(screen.getByLabelText('Tipo de propiedad')).toBeDefined()
    expect(screen.queryByLabelText('Nombre')).toBeNull()
    expect(screen.queryByLabelText('Calle')).toBeNull()
  })
})
