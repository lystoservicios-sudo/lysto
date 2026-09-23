import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CompleteProfileForm } from '../../components/auth/customer-forms'
import { RegistrationForm } from '../../app/(auth)/registro/registration-form'
afterEach(cleanup)
const policy = { termsVersion: 't1', privacyVersion: 'p1', termsUrl: 'https://lysto.test/terminos', privacyUrl: 'https://lysto.test/privacidad', testOnly: false }
describe('customer account UI', () => {
  it('requires explicit consent without role language', () => {
    const { container } = render(<RegistrationForm policy={policy} next="/app" />)
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
  it('shows only missing information with mobile-friendly phone input', () => {
    render(<CompleteProfileForm missing={['phone', 'property_type']} next="/app" />)
    expect(screen.getByLabelText('Teléfono').getAttribute('type')).toBe('tel')
    expect(screen.getByLabelText('Tipo de propiedad')).toBeDefined()
    expect(screen.queryByLabelText('Nombre')).toBeNull()
    expect(screen.queryByLabelText('Calle')).toBeNull()
  })
})
