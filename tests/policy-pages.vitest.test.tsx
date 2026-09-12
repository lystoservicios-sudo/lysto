import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TermsPage from '@/app/(public)/terminos/page'
import PrivacyPage from '@/app/(public)/privacidad/page'
import CancellationsPage from '@/app/(public)/cancelaciones/page'
import HowItWorksPage from '@/app/(public)/como-funciona/page'

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
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

  it('describes the canonical assignment-before-checkout flow', () => {
    render(<HowItWorksPage />)
    const text = document.body.textContent ?? ''
    expect(text.indexOf('Un profesional disponible acepta')).toBeLessThan(
      text.indexOf('Pagás mediante Mercado Pago')
    )
    expect(text).toContain('La reseña')
  })
})
