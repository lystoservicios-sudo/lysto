import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { QuoteBreakdown } from '@/components/pricing/quote-breakdown'
import { calculateServiceQuote } from '@/lib/pricing/service-quote'
afterEach(cleanup)
it('shows missing costs as pending and separates initial markup from extra policy', () => {
  render(<QuoteBreakdown internal quote={calculateServiceQuote({ issue: 'mantenimiento', urgency: 'flexible', propertyType: 'house', access: {} })} />)
  expect(screen.getByText('Recargo de protección (30%)')).toBeTruthy()
  expect(screen.getByText('Traslado pendiente de verificación')).toBeTruthy()
  expect(screen.getByText(/100% para el profesional/)).toBeTruthy()
  expect(screen.queryByText('Precio final confirmado')).toBeNull()
})

it('shows approved state without presenting resolved warnings as blockers', () => {
  const quote = calculateServiceQuote({ issue: 'mantenimiento', urgency: 'flexible', propertyType: 'house', access: {} })
  render(<QuoteBreakdown quote={quote} status="ready" />)
  expect(screen.getByText('Presupuesto verificado por operaciones')).toBeTruthy()
  expect(screen.queryByText('Antes de confirmar')).toBeNull()
  expect(quote.reviewReasons).toContain('travel_unverified')
})
