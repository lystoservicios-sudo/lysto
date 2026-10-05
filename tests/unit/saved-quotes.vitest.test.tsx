import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/pricing/quote-breakdown', () => ({
  QuoteBreakdown: () => <div>Detalle del presupuesto</div>
}))

import { SavedQuotes } from '@/components/pricing/saved-quotes'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const quote = {
  id: 'quote-expired-1',
  customer_id: 'customer-1',
  input: {},
  address: { street: 'Pavón', number: '2012', city: 'CABA', province: 'Buenos Aires' },
  quote: { scope: 'Mantenimiento', total: 1000 },
  status: 'needs_review',
  request_id: null,
  expires_at: '2000-01-01T00:00:00.000Z',
  version: 1,
  revision: 1,
  previous_quote_id: null
}

describe('admin saved quotes', () => {
  it('explains an expired quote and links to its recalculation in the calculator', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ quotes: [quote] })))
    )

    render(<SavedQuotes internal canReview />)

    expect(await screen.findByText(/Este presupuesto venció/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Recalcular presupuesto' }).getAttribute('href')).toBe(
      '/admin/calculadora#presupuesto-quote-expired-1'
    )
  })

  it('explains the minimum review note required to validate an active quote', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ quotes: [{ ...quote, expires_at: '2099-01-01T00:00:00.000Z' }] })
        )
      )
    )

    render(<SavedQuotes internal canReview />)

    expect(await screen.findByText(/fundamento de al menos 15 caracteres/)).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Validar alcance e importes' }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
  })
})
