import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { InvitationEntry } from '@/components/pro/invitation-entry'
import { RegistrationRetry } from '@/components/pro/registration-access'

const mocks = vi.hoisted(() => ({ request: vi.fn(), login: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }))
vi.mock('@/lib/http/private-client', () => ({ privateRequest: mocks.request, requestError: String }))
vi.mock('@/app/(auth)/equipo/login/actions', () => ({ loginAction: mocks.login }))

afterEach(() => { cleanup(); vi.resetAllMocks() })

it('uses the provisioned account and provisional password as the default invitation access', async () => {
  const token = 'a'.repeat(43)
  mocks.login.mockResolvedValue({ status: 'error', email: 'tecnico@example.test', message: 'No pudimos validar la invitación. Revisá el correo recibido o pedí ayuda a Lysto.' })
  render(<InvitationEntry token={token} />)
  expect(screen.getByRole('heading', { name: 'Ingresá para comenzar' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Creá tu contraseña' })).toBeNull()
  const email = screen.getByLabelText('Correo electrónico') as HTMLInputElement
  const password = screen.getByLabelText('Contraseña provisoria o actual') as HTMLInputElement
  expect(email.value).toBe('')
  expect(password.minLength).not.toBe(8)
  expect(password.autocomplete).toBe('current-password')
  const form = email.closest('form')!
  expect((form.elements.namedItem('next') as HTMLInputElement).value).toBe(`/pro/onboarding/${token}`)
  fireEvent.change(email, { target: { value: 'tecnico@example.test' } })
  fireEvent.change(password, { target: { value: '1234567' } })
  fireEvent.submit(form)
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No pudimos validar la invitación'))
  const sent = mocks.login.mock.calls[0][1] as FormData
  expect(sent.get('email')).toBe('tecnico@example.test')
  expect(sent.get('password')).toBe('1234567')
  expect(sent.get('next')).toBe(`/pro/onboarding/${token}`)
  expect(mocks.request).not.toHaveBeenCalled()
})

it('can resume without a token and never offers public technician signup', () => {
  render(<InvitationEntry />)
  expect(screen.getByRole('heading', { name: 'Retomá tu registro' })).toBeTruthy()
  const email = screen.getByLabelText('Correo electrónico') as HTMLInputElement
  expect((email.form!.elements.namedItem('next') as HTMLInputElement).value).toBe('/pro/onboarding')
  expect(screen.queryByRole('link', { name: 'Crear una cuenta' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Necesito ayuda' }).getAttribute('href')).toBe('/contacto')
})

it('reveals a password without submitting it or clearing its value', () => {
  render(<InvitationEntry token={'b'.repeat(43)} />)
  const password = screen.getByLabelText('Contraseña provisoria o actual') as HTMLInputElement
  fireEvent.change(password, { target: { value: '1234567' } })
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
  expect(password.type).toBe('text')
  expect(password.value).toBe('1234567')
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
  expect(password.type).toBe('password')
  expect(mocks.login).not.toHaveBeenCalled()
})

it('rejects a malformed invitation locally without exposing it or sending credentials', () => {
  render(<InvitationEntry token="bad-token" />)
  expect(screen.getByRole('heading', { name: 'Este enlace no es válido' })).toBeTruthy()
  expect(screen.queryByLabelText('Correo electrónico')).toBeNull()
  expect(screen.queryByText('bad-token')).toBeNull()
  expect(screen.getByRole('link', { name: 'Retomar con mi cuenta' }).getAttribute('href')).toBe('/equipo/login?next=%2Fpro%2Fonboarding')
  expect(mocks.request).not.toHaveBeenCalled()
})

it('blocks duplicate access and legacy switching while authentication is pending', async () => {
  let finish!: (value: { status: 'error'; email: string; message: string }) => void
  mocks.login.mockReturnValue(new Promise((resolve) => { finish = resolve }))
  render(<InvitationEntry token={'c'.repeat(43)} />)
  const email = screen.getByLabelText('Correo electrónico') as HTMLInputElement
  const password = screen.getByLabelText('Contraseña provisoria o actual') as HTMLInputElement
  fireEvent.change(email, { target: { value: 'tecnico@example.test' } })
  fireEvent.change(password, { target: { value: '1234567' } })
  fireEvent.submit(email.form!)
  await waitFor(() => expect((screen.getByRole('button', { name: 'Ingresando…' }) as HTMLButtonElement).disabled).toBe(true))
  expect(email.disabled).toBe(true)
  expect(password.disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Tengo una invitación anterior sin clave provisoria' }) as HTMLButtonElement).disabled).toBe(true)
  await act(async () => { finish({ status: 'error', email: 'tecnico@example.test', message: 'Intentá nuevamente.' }) })
  expect((screen.getByRole('button', { name: 'Ingresar y continuar' }) as HTMLButtonElement).disabled).toBe(false)
})

it('clears credentials and invitation errors when another invitation is opened', async () => {
  mocks.login.mockResolvedValue({ status: 'error', email: 'primero@example.test', message: 'La invitación ya no está disponible.' })
  const { rerender } = render(<InvitationEntry token={'d'.repeat(43)} />)
  const email = screen.getByLabelText('Correo electrónico') as HTMLInputElement
  fireEvent.change(email, { target: { value: 'primero@example.test' } })
  fireEvent.change(screen.getByLabelText('Contraseña provisoria o actual'), { target: { value: '1234567' } })
  fireEvent.submit(email.form!)
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
  rerender(<InvitationEntry token={'e'.repeat(43)} />)
  expect(screen.queryByRole('alert')).toBeNull()
  expect((screen.getByLabelText('Correo electrónico') as HTMLInputElement).value).toBe('')
  expect((screen.getByLabelText('Contraseña provisoria o actual') as HTMLInputElement).value).toBe('')
})

it('refreshes the unavailable server context instead of navigating to a cached landing', () => {
  render(<RegistrationRetry />)
  fireEvent.click(screen.getByRole('button', { name: 'Volver a intentar' }))
  expect(mocks.refresh).toHaveBeenCalledOnce()
  expect(mocks.replace).not.toHaveBeenCalled()
})
