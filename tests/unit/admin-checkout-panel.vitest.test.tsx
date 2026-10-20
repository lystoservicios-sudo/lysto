import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PaymentPanel } from '@/components/payments/payment-panel'
const row = {
  id: 'checkout-1', job_id: 'job-1', extra_id: 'extra-1', amount: '100',
  marketplace_fee: '18', professional_amount: '82', status: 'ready', live_mode: true,
  expires_at: '2030-01-01T00:00:00Z', review_reason: null, observations: []
}
const fetcher = vi.fn()
beforeEach(() => {
  window.history.replaceState({}, '', '/admin/pagos')
  fetcher.mockReset().mockImplementation(async (_url, options) =>
    Response.json(options?.method === 'POST' ? { ok: true } : { role: 'admin', checkouts: [row] }))
  vi.stubGlobal('fetch', fetcher)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('does not describe a commissioned administrative extra as commission free', async () => {
  render(<PaymentPanel role="admin" />)
  await screen.findByRole('heading', { name: /Cobro adicional/ })
  expect(screen.queryByText(/Adicional sin comisión Lysto/)).toBeNull()
})
it('reviews the checkout amount before closing its payment link', async () => {
  render(<PaymentPanel role="admin" />)
  fireEvent.click(await screen.findByRole('button', { name: 'Cerrar enlace para cancelación' }))
  expect(screen.getByRole('dialog', { name: 'Cerrar enlace de pago' })).toBeTruthy()
  expect(fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre del enlace' }))
  await screen.findByText(/El enlace quedó cerrado/)
  expect(JSON.parse(fetcher.mock.calls.find(([, options]) => options?.method === 'POST')![1].body))
    .toEqual({ action: 'closeCheckout', checkoutId: row.id })
})
