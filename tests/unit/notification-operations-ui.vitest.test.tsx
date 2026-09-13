import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ConnectedNotificationDeliveries } from '../../components/admin/connected-notification-deliveries'

const delivery = {
  id: '11111111-1111-4111-8111-111111111111',
  eventType: 'professional.invited',
  channel: 'email' as const,
  createdAt: '2026-09-12T12:00:00Z',
  availableAt: '2026-09-12T12:01:00Z',
  attemptCount: 8,
  maxAttempts: 8,
  state: 'dead_letter' as const,
  lastError: 'provider_http_503',
  providerAccepted: false,
  version: 3
}
const page = {
  items: [delivery],
  total: 1,
  nextCursor: null,
  counts: { queued: 0, leased: 0, processed: 0, deadLetter: 1, suppressed: 0, manual: 0 },
  emailAllowance: {
    daily: { accepted: 90, limit: 100 as const, state: 'critical' as const },
    monthly: { accepted: 2800, limit: 3000 as const, state: 'critical' as const }
  }
}
afterEach(() => vi.unstubAllGlobals())
it('shows operational state without recipient, payload or false inbox-delivery claims', () => {
  render(<ConnectedNotificationDeliveries initial={page} />)
  expect(screen.getByText('Requiere intervención')).toBeTruthy()
  expect(screen.getByText(/proveedor no confirma/i)).toBeTruthy()
  expect(screen.getByText('90 de 100')).toBeTruthy()
  expect(screen.getByText('2800 de 3000')).toBeTruthy()
  expect(screen.getByText(/pausá primero las solicitudes de calificación/i)).toBeTruthy()
  expect(document.body.textContent).not.toContain('recipient')
})
it('requires an operator reason and sends the event version when retrying', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        delivery: { ...delivery, state: 'queued', attemptCount: 0, version: 4, lastError: null }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  )
  vi.stubGlobal('fetch', fetcher)
  render(<ConnectedNotificationDeliveries initial={page} />)
  fireEvent.change(screen.getByLabelText('Motivo del reintento'), {
    target: { value: 'Proveedor recuperado y configuración revisada' }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar entrega' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalled())
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
    eventId: delivery.id,
    expectedVersion: 3,
    reason: 'Proveedor recuperado y configuración revisada'
  })
})
