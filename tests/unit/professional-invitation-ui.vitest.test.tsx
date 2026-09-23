import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ConnectedProfessionalInvitations } from '@/components/admin/connected-professional-invitations'

const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('@/lib/http/private-client', () => ({
  privateRequest: mocks.request,
  requestError: (error: unknown) => String(error)
}))
afterEach(() => { cleanup(); mocks.request.mockReset() })

it('shows the newly created link and does not fetch it from the invitation listing', async () => {
  const link = `https://lystohogar.com/pro/onboarding/${'a'.repeat(43)}`
  const invitation = {
    id: '96000000-0000-4000-8000-000000000001', email: 'tecnico@example.com',
    specialtySlug: 'aire_acondicionado', status: 'queued' as const,
    expiresAt: '2026-10-06T12:00:00Z', createdAt: '2026-09-22T12:00:00Z', version: 1
  }
  mocks.request.mockImplementation(async (url: string) => url === '/api/admin/invite-professional'
    ? { invitation, link, delivery: { accepted: true, reason: null } }
    : { items: [invitation], total: 1, nextCursor: null })
  render(<ConnectedProfessionalInvitations
    initial={{ items: [], total: 0, nextCursor: null }}
    categories={[{ id: '96000000-0000-4000-8000-000000000002', name: 'Aire acondicionado', slug: 'aire_acondicionado' }]}
  />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Crear invitación' }).hasAttribute('disabled')).toBe(false))
  fireEvent.change(screen.getByLabelText('Correo del profesional'), { target: { value: 'tecnico@example.com' } })
  fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'aire_acondicionado' } })
  fireEvent.change(screen.getByLabelText('Motivo de la convocatoria'), { target: { value: 'Convocatoria para técnico de aire acondicionado' } })
  fireEvent.click(screen.getByRole('button', { name: 'Crear invitación' }))
  await waitFor(() => expect(screen.getByRole('link', { name: 'Abrir enlace de invitación' }).getAttribute('href')).toBe(link))
  expect(screen.getByRole('status').textContent).toContain('Correo aceptado para envío')
  expect(screen.queryByText('Invitación registrada y en cola de entrega.')).toBeNull()
  expect(screen.getByText('tecnico@example.com')).toBeTruthy()
  expect(mocks.request).toHaveBeenCalledWith('/api/admin/professionals/invitations')
})

it('shows a delivery error and the one-time link when email is not configured', async () => {
  const link = `https://lystohogar.com/pro/onboarding/${'b'.repeat(43)}`
  const invitation = {
    id: '96000000-0000-4000-8000-000000000001', email: 'tecnico@example.com',
    specialtySlug: 'aire_acondicionado', status: 'queued' as const,
    expiresAt: '2026-10-06T12:00:00Z', createdAt: '2026-09-22T12:00:00Z', version: 1
  }
  mocks.request.mockImplementation(async (url: string) => url === '/api/admin/invite-professional'
    ? { invitation, link, delivery: { accepted: false, reason: 'email_not_configured' } }
    : { items: [invitation], total: 1, nextCursor: null })
  render(<ConnectedProfessionalInvitations initial={{ items: [], total: 0, nextCursor: null }}
    categories={[{ id: '96000000-0000-4000-8000-000000000002', name: 'Aire acondicionado', slug: 'aire_acondicionado' }]} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Crear invitación' }).hasAttribute('disabled')).toBe(false))
  fireEvent.change(screen.getByLabelText('Correo del profesional'), { target: { value: 'tecnico@example.com' } })
  fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'aire_acondicionado' } })
  fireEvent.change(screen.getByLabelText('Motivo de la convocatoria'), { target: { value: 'Convocatoria para técnico de aire acondicionado' } })
  fireEvent.click(screen.getByRole('button', { name: 'Crear invitación' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('El correo no está configurado'))
  expect(screen.getByRole('link', { name: 'Abrir enlace de invitación' }).getAttribute('href')).toBe(link)
  expect(screen.queryByText('Invitación registrada y en cola de entrega.')).toBeNull()
})

it('retries an unsent invitation without creating a second one', async () => {
  const invitation = {
    id: '96000000-0000-4000-8000-000000000001', email: 'tecnico@example.com',
    specialtySlug: 'aire_acondicionado', status: 'queued' as const,
    expiresAt: '2026-10-06T12:00:00Z', createdAt: '2026-09-22T12:00:00Z', version: 1
  }
  mocks.request.mockImplementation(async (_url: string, method?: string) => method === 'PUT'
    ? { delivery: { accepted: true, reason: null } }
    : { items: [{ ...invitation, status: 'sent' }], total: 1, nextCursor: null })
  render(<ConnectedProfessionalInvitations initial={{ items: [invitation], total: 1, nextCursor: null }} categories={[]} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Reintentar envío a tecnico@example.com' }).hasAttribute('disabled')).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar envío a tecnico@example.com' }))
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Correo aceptado para envío'))
  expect(mocks.request).toHaveBeenCalledWith('/api/admin/invite-professional', 'PUT', { invitationId: invitation.id })
  expect(mocks.request).not.toHaveBeenCalledWith('/api/admin/invite-professional', 'POST', expect.anything())
})
