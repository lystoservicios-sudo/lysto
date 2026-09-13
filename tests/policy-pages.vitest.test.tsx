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
    [PrivacyPage, 'Privacidad'],
    [CancellationsPage, 'Cancelaciones, reprogramaciones y reintegros']
  ] as const)('labels unapproved policy copy and exposes its sections', (Page, heading) => {
    render(<Page />)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy()
    expect(screen.getByText(/pendiente de aprobación/i)).toBeTruthy()
  })

  it('keeps the previous explanation URL connected to the new solution page', () => {
    expect(() => HowItWorksPage()).toThrow('redirect:/solucion')
  })
})
