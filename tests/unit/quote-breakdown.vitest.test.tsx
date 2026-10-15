import { cleanup, render, screen, within } from '@testing-library/react'
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

it('shows only the contractual gross split even when an accepted snapshot retains a legacy provider budget', () => {
  const quote = {
    ...calculateServiceQuote({ issue: 'mantenimiento', urgency: 'flexible', propertyType: 'house', access: {} }),
    total: 1000, platformFee: 180, professionalAmount: 820, paymentCostBudget: 60,
    reviewReasons: ['professional_net_floor']
  }
  const original = JSON.stringify(quote)
  render(<QuoteBreakdown quote={quote} internal status="accepted" />)
  expect(screen.queryByText('Costo estimado de Mercado Pago para el profesional')).toBeNull()
  expect(screen.queryByText('Neto estimado del profesional')).toBeNull()
  const professional = screen.getByText('Parte bruta del profesional').parentElement!
  const lysto = screen.getByText('Comisión Lysto (18%)').parentElement!
  expect(within(professional).getByText(/820/)).toBeTruthy()
  expect(within(lysto).getByText(/180/)).toBeTruthy()
  expect(screen.getByText(/Los cargos reales de Mercado Pago se registran por separado cuando confirma el pago/)).toBeTruthy()
  expect(JSON.stringify(quote)).toBe(original)
})
