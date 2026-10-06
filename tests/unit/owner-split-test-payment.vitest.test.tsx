// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

import { OwnerSplitTestPayment } from '@/components/payments/owner-split-test-payment'

it('offers the fixed ARS 1,000 split checkout and redirects to Mercado Pago', async () => {
  const assign = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ initPoint: 'https://mp.test/pay' }), { status: 200 })))
  vi.stubGlobal('location', { assign })

  render(<OwnerSplitTestPayment />)
  fireEvent.click(screen.getByRole('button', { name: 'Pagar $ 1.000 con Mercado Pago' }))

  await waitFor(() => expect(assign).toHaveBeenCalledWith('https://mp.test/pay'))
})
