import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { InvitationEntry } from '@/components/pro/invitation-entry'

const mocks = vi.hoisted(() => ({ request: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }))
vi.mock('@/lib/http/private-client', () => ({ privateRequest: mocks.request, requestError: String }))
afterEach(() => { cleanup(); mocks.request.mockReset(); mocks.replace.mockReset(); mocks.refresh.mockReset() })

it('accepts an invitation by setting an 8–12 character password without another button', async () => {
  const token = 'a'.repeat(43)
  mocks.request.mockResolvedValue({ professionalId: '96000000-0000-4000-8000-000000000001' })
  render(<InvitationEntry token={token} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' }).hasAttribute('disabled')).toBe(false))
  const password = screen.getByLabelText('Contraseña') as HTMLInputElement
  expect(password.minLength).toBe(8)
  expect(password.maxLength).toBe(12)
  expect(screen.queryByRole('button', { name: 'Aceptar invitación' })).toBeNull()
  expect(screen.queryByLabelText('Correo invitado')).toBeNull()
  fireEvent.change(password, { target: { value: 'Clav3Seg!' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await waitFor(() => expect(mocks.request).toHaveBeenCalledWith('/api/professional/onboarding/register', 'POST', {
    token, password: 'Clav3Seg!', existingPassword: false
  }))
  expect(mocks.replace).toHaveBeenCalledWith('/pro/onboarding')
})

it('lets an older invitation use a password that was already created', async () => {
  const token = 'b'.repeat(43)
  mocks.request.mockResolvedValue({ professionalId: '96000000-0000-4000-8000-000000000001' })
  render(<InvitationEntry token={token} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' }).hasAttribute('disabled')).toBe(false))
  fireEvent.click(screen.getByLabelText('Ya había creado una contraseña con una invitación anterior'))
  const password = screen.getByLabelText('Contraseña') as HTMLInputElement
  expect(password.maxLength).toBe(128)
  fireEvent.change(password, { target: { value: 'old-password-long' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await waitFor(() => expect(mocks.request).toHaveBeenCalledWith('/api/professional/onboarding/register', 'POST', {
    token, password: 'old-password-long', existingPassword: true
  }))
})
