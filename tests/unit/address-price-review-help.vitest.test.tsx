import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ReviewScreen } from '@/features/service-request/request-screen-parts'
import { createRequestDraft, getSelectedRequestAnswers } from '@/features/service-request/request-draft'

it('keeps an unverified route pending without offering an unvalidated-address bypass', () => {
  const retry = vi.fn()
  render(<ReviewScreen equipment={null} answers={getSelectedRequestAnswers(createRequestDraft('customer'))}
    homeRoom="Living" address="Calle escrita S/N, Quilmes, Buenos Aires" busy={false} onEdit={vi.fn()} onRetry={retry}
    preview={{ status: 'needs_review', reason: 'travel_unverified', message: 'Necesitamos verificar el traslado.' }} />)
  expect(screen.queryByRole('link', { name: 'Pedir ayuda con esta dirección' })).toBeNull()
  expect(screen.queryByText(/Todavía no se envió el pedido/)).toBeNull()
  expect(screen.getByRole('button', { name: 'Volver a comprobar el presupuesto' })).toBeTruthy()
  expect(retry).not.toHaveBeenCalled()
  expect(screen.queryByText(/revisión recibida/i)).toBeNull()
})

it('does not show address-help instructions while a valid price is ready', () => {
  render(<ReviewScreen equipment={null} answers={getSelectedRequestAnswers(createRequestDraft('customer'))}
    homeRoom="Living" address="Dirección confirmada" busy={false} onEdit={vi.fn()} onRetry={vi.fn()}
    preview={{ status: 'ready' }} />)
  expect(screen.queryByRole('link', { name: 'Pedir ayuda con esta dirección' })).toBeNull()
})
