import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { LiveProfessionalDashboard } from '@/components/pro/live-professional'

vi.mock('next/navigation', () => ({ usePathname: () => '/pro/dashboard' }))

it('shows a normal dashboard shell with review pending and no job offers', () => {
  render(<LiveProfessionalDashboard name="Ana" rating={null} jobs={[]} pending />)
  expect(screen.getByText(/revisión pendiente/i)).toBeTruthy()
  expect(screen.getByRole('link', { name: /continuar mi perfil/i }).getAttribute('href')).toBe('/pro/onboarding')
  expect(screen.queryByRole('link', { name: /Ver propuestas/ })).toBeNull()
})
