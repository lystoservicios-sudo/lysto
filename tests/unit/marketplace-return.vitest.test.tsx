// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { PaymentPanel } from '@/components/payments/payment-panel'
import { checkoutBackUrls } from '@/lib/payments/checkout-contract'

const checkoutId = '92000000-0000-0000-0000-000000000001'
const jobId = '92000000-0000-0000-0000-000000000002'

beforeEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState({}, '', `/app/trabajos/${jobId}?checkout=${checkoutId}&pago=retorno`)
})

it('binds provider return URLs to the checkout being paid', () => {
  expect(checkoutBackUrls('https://lysto.test', jobId, checkoutId)).toEqual({
    success: `https://lysto.test/app/trabajos/${jobId}?checkout=${checkoutId}&pago=retorno`,
    pending: `https://lysto.test/app/trabajos/${jobId}?checkout=${checkoutId}&pago=pendiente`,
    failure: `https://lysto.test/app/trabajos/${jobId}?checkout=${checkoutId}&pago=reintentar`
  })
})

it('checks the canonical provider state automatically on return', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') return new Response(JSON.stringify({ updated: true }), { status: 200 })
    return new Response(JSON.stringify({ role: 'customer', checkouts: [{
      id: checkoutId, job_id: jobId, extra_id: null, amount: '100.00', marketplace_fee: '18.00',
      professional_amount: '82.00', status: 'ready', live_mode: true,
      expires_at: '2026-12-01T00:00:00Z', review_reason: null, observations: []
    }] }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  render(<PaymentPanel jobId={jobId} jobStatus="confirmed" role="customer" />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/mercadopago/checkouts',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ checkoutId, action: 'reconcile_return' }) })))
  expect(window.location.search).not.toContain('pago=')
  vi.unstubAllGlobals()
})
