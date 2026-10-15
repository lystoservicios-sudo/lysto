import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const actions = vi.hoisted(() => ({ recovery: vi.fn(), resend: vi.fn() }))
vi.mock('@/app/(auth)/actions', () => ({ recoverPasswordAction: actions.recovery, resendConfirmationAction: actions.resend }))
import { EmailHelpForm } from '../../components/auth/customer-forms'
import { GENERIC_RECOVERY_MESSAGE } from '../../lib/auth/account-lifecycle'

beforeEach(() => {
  vi.clearAllMocks()
  const result = { status: 'success', email: 'ana@example.test', message: GENERIC_RECOVERY_MESSAGE }
  actions.recovery.mockResolvedValue(result)
  actions.resend.mockResolvedValue(result)
})
afterEach(cleanup)

describe('customer email assistance', () => {
  it('shows a generic review-email state and lets the customer use another email', async () => {
    render(<EmailHelpForm mode="recovery" />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByRole('heading', { name: 'Revisá tu correo' })).toBeDefined()
    expect(screen.getByRole('status').textContent).toBe(GENERIC_RECOVERY_MESSAGE)
    expect(screen.queryByRole('button', { name: 'Enviar enlace' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Usar otro email' }))
    expect(screen.getByLabelText('Email')).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Revisá tu correo' })).toBeNull()
    expect(actions.recovery).toHaveBeenCalledTimes(1)
  })
  it('uses confirmation resend and keeps the requested destination', async () => {
    render(<EmailHelpForm mode="confirmation" next="/app/hogar" />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar confirmación' }))
    await waitFor(() => expect(actions.resend).toHaveBeenCalledTimes(1))
    expect((actions.resend.mock.calls[0][1] as FormData).get('next')).toBe('/app/hogar')
    expect(await screen.findByRole('heading', { name: 'Revisá tu correo' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' }).getAttribute('href')).toBe('/login?next=%2Fapp%2Fhogar')
    expect(actions.recovery).not.toHaveBeenCalled()
  })
})
