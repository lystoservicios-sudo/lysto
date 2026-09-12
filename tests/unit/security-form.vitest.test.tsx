import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  enroll: vi.fn(),
  verify: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn()
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh })
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      mfa: { enroll: mocks.enroll, challengeAndVerify: mocks.verify },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } })
    }
  })
}))
import { SecurityForm } from '@/app/(auth)/seguridad/security-form'
const factor = { id: '10000000-0000-4000-8000-000000000001', name: 'Mi autenticador' }
beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(cleanup)
it('does not enroll a factor by merely viewing the security page', () => {
  render(<SecurityForm factors={[]} assuranceLevel="aal1" destination="/admin/dashboard" />)
  expect(mocks.enroll).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Configurar autenticador' })).toBeTruthy()
})
it('does not navigate when verification fails', async () => {
  mocks.verify.mockResolvedValue({ error: { message: 'PRIVATE provider detail' } })
  render(<SecurityForm factors={[factor]} assuranceLevel="aal1" destination="/admin/dashboard" />)
  fireEvent.change(screen.getByLabelText('Código del autenticador'), {
    target: { value: '123456' }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Verificar y continuar' }))
  await screen.findByRole('alert')
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(screen.queryByText(/PRIVATE/)).toBeNull()
})
it('clears setup material and refreshes the server session only after actual verification succeeds', async () => {
  mocks.enroll.mockResolvedValue({
    data: {
      id: factor.id,
      type: 'totp',
      totp: {
        secret: 'PUBLIC-TEST-SECRET',
        qr_code: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"></svg>'
      }
    },
    error: null
  })
  mocks.verify.mockResolvedValue({ data: { access_token: 'test-response' }, error: null })
  render(<SecurityForm factors={[]} assuranceLevel="aal1" destination="/admin/dashboard" />)
  fireEvent.click(screen.getByRole('button', { name: 'Configurar autenticador' }))
  await screen.findByLabelText('Clave de configuración')
  const qr = screen.getByAltText('QR para configurar tu autenticador')
  expect(decodeURIComponent(qr.getAttribute('src')!.split(',').slice(1).join(','))).toBe('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
  fireEvent.change(screen.getByLabelText('Código del autenticador'), {
    target: { value: '123456' }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Verificar y continuar' }))
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/admin/dashboard'))
  expect(mocks.refresh).toHaveBeenCalled()
  expect(screen.queryByLabelText('Clave de configuración')).toBeNull()
})
it('does not display setup material when enrollment fails', async () => {
  mocks.enroll.mockResolvedValue({ data: null, error: { message: 'PRIVATE provider detail' } })
  render(<SecurityForm factors={[]} assuranceLevel="aal1" destination="/admin/dashboard" />)
  fireEvent.click(screen.getByRole('button', { name: 'Configurar autenticador' }))
  await screen.findByRole('alert')
  expect(screen.queryByLabelText('Clave de configuración')).toBeNull()
})
