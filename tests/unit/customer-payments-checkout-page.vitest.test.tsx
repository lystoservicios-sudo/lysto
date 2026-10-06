// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@/components/payments/payment-panel', () => ({
  PaymentPanel: ({ jobId, jobStatus, serviceAmount }: { jobId?: string; jobStatus?: string; serviceAmount?: number | null }) =>
    jobId ? <div data-testid={`payment-${jobId}`}>{jobStatus}:{serviceAmount}</div> : <div>Movimientos</div>
}))
vi.mock('@/components/layout/page-scaffold', () => ({
  PageScaffold: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}))
vi.mock('@/lib/auth/session', () => ({ requirePageSession: vi.fn(async () => ({ role: 'customer' })) }))
vi.mock('@/lib/customer/live-model', () => ({
  listCustomerJobsLive: vi.fn(async () => ({
    items: [{ id: 'job-confirmed-1', status: 'confirmed', amount: 1000 }]
  }))
}))

import CustomerPaymentsPage from '@/app/(customer)/app/pagos/page'

afterEach(() => cleanup())

it('shows the assigned service checkout from the customer payments page', async () => {
  render(await CustomerPaymentsPage())

  expect(screen.getByTestId('payment-job-confirmed-1').textContent).toBe('confirmed:1000')
})
