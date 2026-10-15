// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const jobId = 'd046d214-fb6d-48ab-81c0-7a7f0e630d48'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), notFound: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({
  requirePageSession: vi.fn(async () => ({ role: 'customer', customerId: 'owned-customer' }))
}))
vi.mock('@/lib/customer-more/payments', () => ({
  listCustomerPayments: vi.fn(async () => ({
    filter: 'todos', page: 1, pageSize: 20, total: 1, hasNext: false, hasPrevious: false,
    items: [{ id: 'pending-service', jobId: 'd046d214-fb6d-48ab-81c0-7a7f0e630d48', checkoutId: null, extraLabel: null,
      service: 'Mantenimiento preventivo', professional: 'Profesional asignado', amount: 1000,
      status: null, liveMode: null, createdAt: '2026-10-14T18:00:00Z', expiresAt: null, hasRefund: false }]
  })),
  readCustomerPaymentDetail: vi.fn(async () => ({
    id: 'd046d214-fb6d-48ab-81c0-7a7f0e630d48', status: 'confirmed', service: 'Mantenimiento preventivo',
    professional: 'Profesional asignado', amount: 1000, canStartPayment: true, scheduledDate: null,
    timeWindow: null, createdAt: '2026-10-14T18:00:00Z', checkouts: [], extras: [], serviceReceipt: null
  }))
}))

import CustomerPaymentsPage from '@/app/(customer)/app/pagos/page'
import CustomerPaymentDetailPage from '@/app/(customer)/app/pagos/[id]/page'

afterEach(() => cleanup())

it('links the assigned service from payments without an owner test widget', async () => {
  render(await CustomerPaymentsPage({ searchParams: Promise.resolve({}) }))
  expect(screen.getByRole('link', { name: /Mantenimiento preventivo/ }).getAttribute('href')).toBe(`/app/pagos/${jobId}`)
  expect(screen.queryByText(/prueba de reparto/i)).toBeNull()
})

it('offers the canonical Mercado Pago checkout from the owned assigned service detail', async () => {
  render(await CustomerPaymentDetailPage({ params: Promise.resolve({ id: jobId }) }))
  expect(screen.getByRole('button', { name: /Pagar.*1\.000,00 con Mercado Pago/ })).toBeTruthy()
})
