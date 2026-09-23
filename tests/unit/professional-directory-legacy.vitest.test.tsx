import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { ConnectedProfessionalDirectory } from '@/components/admin/connected-professional-directory'

afterEach(cleanup)

it('shows existing approved professionals as eligible before the readiness migration', () => {
  render(<ConnectedProfessionalDirectory initial={{
    items: [{
      id: '96000000-0000-4000-8000-000000000001',
      createdAt: '2026-09-22T12:00:00Z',
      version: 1,
      firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com',
      status: 'approved', eligible: true, invited: false
    }], total: 1, nextCursor: null
  }} />)
  expect(screen.getByRole('row', { name: /Ana Pérez/ }).textContent).toContain('Puede recibir')
})
