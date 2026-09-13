import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  LoginFormView,
  type LoginFormViewProps
} from '../../app/(auth)/login/login-form'

afterEach(cleanup)

function renderForm(overrides: Partial<LoginFormViewProps> = {}) {
  const formAction = vi.fn()
  render(
    <LoginFormView
      state={{ status: 'idle', email: '', message: '' }}
      pending={false}
      formAction={formAction}
      {...overrides}
    />
  )
  return { formAction }
}

describe('mobile login form', () => {
  it('exposes accessible login fields and the registration path', () => {
    renderForm()

    const email = screen.getByLabelText('Email') as HTMLInputElement
    const password = screen.getByLabelText('Contraseña') as HTMLInputElement
    const submit = screen.getByRole('button', { name: 'Ingresar' }) as HTMLButtonElement
    const register = screen.getByRole('link', { name: 'Crear una cuenta' })

    expect(email.name).toBe('email')
    expect(email.type).toBe('email')
    expect(email.autocomplete).toBe('email')
    expect(email.required).toBe(true)
    expect(password.name).toBe('password')
    expect(password.type).toBe('password')
    expect(password.autocomplete).toBe('current-password')
    expect(password.required).toBe(true)
    expect(submit.type).toBe('submit')
    expect(register.getAttribute('href')).toBe('/registro?next=%2Fapp')
  })

  it('preserves the email and announces an authentication error', () => {
    renderForm({
      state: {
        status: 'error',
        email: 'admin.demo@lysto.com.ar',
        message: 'El email o la contraseña no son correctos.'
      }
    })

    expect((screen.getByLabelText('Email') as HTMLInputElement).value)
      .toBe('admin.demo@lysto.com.ar')
    expect(screen.getByRole('alert').textContent)
      .toContain('El email o la contraseña no son correctos.')
  })

  it('prevents duplicate submissions while authentication is pending', () => {
    renderForm({ pending: true })

    const submit = screen.getByRole('button', { name: 'Ingresando…' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
  })
})
