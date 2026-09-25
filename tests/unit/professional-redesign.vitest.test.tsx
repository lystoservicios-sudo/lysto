import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ConnectedProfessionalInvitations } from '@/components/admin/connected-professional-invitations'
import { ConnectedProfessionalDirectory } from '@/components/admin/connected-professional-directory'
import { createProfessionalInvitation } from '@/lib/professional/onboarding-service'
import type { Session } from '@/lib/auth/session'
import { ConnectedProfessionalInvitationDetail } from '@/components/admin/connected-professional-invitation-detail'

const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('@/lib/http/private-client', () => ({
  privateRequest: mocks.request,
  requestError: (error: unknown) => String(error)
}))
afterEach(() => { cleanup(); mocks.request.mockReset() })

it('passes the invited names to the invitation RPC without a reason', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: {
    id: '96000000-0000-4000-8000-000000000001', firstName: 'Ana', lastName: 'Pérez',
    email: 'ana@example.com', specialtySlug: 'aire_acondicionado', status: 'queued',
    expiresAt: '2026-10-06T12:00:00Z', createdAt: '2026-09-22T12:00:00Z', version: 1
  }, error: null })
  const session = { role: 'admin', assuranceLevel: 'aal2', permissions: ['operations'], client: { rpc } } as unknown as Session
  await createProfessionalInvitation(session, { firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com', specialtySlug: 'aire_acondicionado' })
  expect(rpc).toHaveBeenCalledWith('create_professional_invitation_v2', {
    p_first_name: 'Ana', p_last_name: 'Pérez', p_email: 'ana@example.com', p_specialty_slug: 'aire_acondicionado'
  })
})

it('creates a professional from only name, surname, email and specialty', async () => {
  mocks.request.mockResolvedValue({ delivery: { accepted: true, reason: null }, link: null })
  render(<ConnectedProfessionalInvitations initial={{ items: [], total: 0, nextCursor: null }}
    categories={[{ id: '96000000-0000-4000-8000-000000000002', name: 'Aire acondicionado', slug: 'aire_acondicionado' }]} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Crear invitación' }).hasAttribute('disabled')).toBe(false))
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } })
  fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Pérez' } })
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@example.com' } })
  fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'aire_acondicionado' } })
  fireEvent.click(screen.getByRole('button', { name: 'Crear invitación' }))
  await waitFor(() => expect(mocks.request).toHaveBeenCalledWith('/api/admin/invite-professional', 'POST', {
    firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com', specialtySlug: 'aire_acondicionado'
  }))
  expect(screen.queryByText('Invitaciones registradas')).toBeNull()
  expect(screen.queryByText('Motivo de la convocatoria')).toBeNull()
})

it('shows invited and active professionals in the same directory with only the add action', () => {
  render(<ConnectedProfessionalDirectory initial={{ total: 2, nextCursor: null, items: [
    { id: '96000000-0000-4000-8000-000000000001', createdAt: '2026-09-22T12:00:00Z', version: 1,
      firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com', status: 'invited',
      eligible: false, readyForNewWork: false, invited: true, source: 'invitation', specialtySlug: 'aire_acondicionado' },
    { id: '96000000-0000-4000-8000-000000000003', createdAt: '2026-09-21T12:00:00Z', version: 1,
      firstName: 'Juan', lastName: 'Díaz', email: 'juan@example.com', status: 'approved',
      eligible: true, readyForNewWork: true, invited: true, source: 'profile', specialtySlug: 'aire_acondicionado' }
  ] }} />)
  expect(screen.getByRole('link', { name: 'Añadir nuevo' }).getAttribute('href')).toBe('/admin/profesionales/invitaciones')
  expect(screen.queryByRole('link', { name: 'Requisitos' })).toBeNull()
  expect(screen.getByRole('row', { name: /Ana Pérez/ }).textContent).toContain('Invitado')
  expect(screen.getByRole('row', { name: /Juan Díaz/ }).textContent).toContain('Puede recibir')
  fireEvent.change(screen.getByLabelText('Buscar profesionales'), { target: { value: 'ana@' } })
  expect(screen.getByRole('row', { name: /Ana Pérez/ })).toBeTruthy()
  expect(screen.queryByRole('row', { name: /Juan Díaz/ })).toBeNull()
})

it('shows exactly what is missing when an invited professional has not accepted', () => {
  render(<ConnectedProfessionalInvitationDetail invitation={{
    id: '96000000-0000-4000-8000-000000000001', firstName: 'Ana', lastName: 'Pérez',
    email: 'ana@example.com', specialtySlug: 'aire_acondicionado', status: 'sent',
    expiresAt: '2026-12-06T12:00:00Z', createdAt: '2026-09-22T12:00:00Z', version: 1
  }} />)
  expect(screen.getByText(/Todavía no creó su contraseña/)).toBeTruthy()
  expect(screen.getByText(/Trabajos: ninguno/)).toBeTruthy()
})
