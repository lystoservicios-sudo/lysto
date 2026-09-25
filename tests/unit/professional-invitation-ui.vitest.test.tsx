import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ConnectedProfessionalInvitationDetail } from '@/components/admin/connected-professional-invitation-detail'

const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('@/lib/http/private-client', () => ({ privateRequest: mocks.request, requestError: String }))
afterEach(() => { cleanup(); mocks.request.mockReset() })

const invitation = {
  id: '96000000-0000-4000-8000-000000000001', firstName: 'Ana', lastName: 'Pérez',
  email: 'tecnico@example.com', specialtySlug: 'aire_acondicionado', status: 'queued' as const,
  expiresAt: '2099-10-06T12:00:00Z', createdAt: '2026-09-22T12:00:00Z', version: 1
}

it('retries an unsent invitation from its expediente without creating another', async () => {
  mocks.request.mockResolvedValue({ delivery: { accepted: true, reason: null } })
  render(<ConnectedProfessionalInvitationDetail invitation={invitation} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Reenviar invitación' }).hasAttribute('disabled')).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Reenviar invitación' }))
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('aceptada'))
  expect(mocks.request).toHaveBeenCalledWith('/api/admin/invite-professional', 'PUT', { invitationId: invitation.id })
  expect(mocks.request).not.toHaveBeenCalledWith('/api/admin/invite-professional', 'POST', expect.anything())
})
