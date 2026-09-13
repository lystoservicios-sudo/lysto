import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CompleteProfileForm, RegistrationForm } from '../../components/auth/customer-forms'
afterEach(cleanup)
describe('customer account UI', () => {
  it('offers Google and real account fields without role language', () => {
    const { container } = render(<RegistrationForm next="/app" />)
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeDefined()
    expect(screen.getByLabelText('Email').getAttribute('name')).toBe('email')
    expect(screen.getByLabelText('Repetir contraseña').getAttribute('name')).toBe('confirmPassword')
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
