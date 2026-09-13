import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CompleteProfileForm } from '../../components/auth/customer-forms'
import { RegistrationForm } from '../../app/(auth)/registro/registration-form'
import { GoogleButton } from '../../components/auth/auth-fields'
afterEach(cleanup)
const policy = { termsVersion: 't1', privacyVersion: 'p1', termsUrl: 'https://lysto.test/terminos', privacyUrl: 'https://lysto.test/privacidad', testOnly: false }
describe('customer account UI', () => {
  it('offers Google and explicit consent without role language', () => {
    const { container } = render(<><GoogleButton /><RegistrationForm policy={policy} next="/app" /></>)
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeDefined()
    expect(screen.getByLabelText('Repetir contraseña').getAttribute('minlength')).toBe('12')
    expect(screen.getByRole('checkbox').hasAttribute('required')).toBe(true)
    expect(screen.getByRole('button', { name: 'Crear mi cuenta' }).getAttribute('type')).toBe('submit')
    expect(container.textContent).not.toMatch(/cliente|técnico|admin|invitación/i)
  })
  it('shows only missing information with mobile-friendly phone input', () => {
    render(<CompleteProfileForm missing={['phone', 'property_type']} next="/app" />)
    expect(screen.getByLabelText('Teléfono').getAttribute('type')).toBe('tel')
    expect(screen.getByLabelText('Tipo de propiedad')).toBeDefined()
    expect(screen.queryByLabelText('Nombre')).toBeNull()
    expect(screen.queryByLabelText('Calle')).toBeNull()
  })
})
