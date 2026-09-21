import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TermsPage from '@/app/(public)/terminos/page'
import PrivacyPage from '@/app/(public)/privacidad/page'
import CancellationsPage from '@/app/(public)/cancelaciones/page'
import HowItWorksPage from '@/app/(public)/como-funciona/page'

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/terminos',
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`) })
}))
afterEach(cleanup)

describe('public policy and service copy', () => {
  it.each([
    [TermsPage, 'Términos del servicio'],
    [PrivacyPage, 'Privacidad']
  ] as const)('publishes a versioned policy and exposes its sections', (Page, heading) => {
    render(<Page />)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy()
    expect(screen.getByText(/versión 2026-09-21/i)).toBeTruthy()
    expect(screen.getByText(/vigente desde el 21 de septiembre de 2026/i)).toBeTruthy()
    expect(screen.queryByText(/pendiente de aprobación/i)).toBeNull()
  })

  it('keeps the cancellation policy marked as a draft', () => {
    render(<CancellationsPage />)
    expect(screen.getByText(/pendiente de aprobación/i)).toBeTruthy()
  })

  it('publishes the customer privacy rights and contact channel', () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('heading', { name: 'Tus derechos' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /contactar a lysto/i }).getAttribute('href')).toBe(
      '/contacto'
    )
  })

  it('keeps the previous explanation URL connected to the new solution page', () => {
    expect(() => HowItWorksPage()).toThrow('redirect:/solucion')
  })
})
