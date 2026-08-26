import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CustomerPaymentsCenter } from '@/components/customer/customer-payments-center'
import { PaymentMovementCard } from '@/components/customer/payment-movement-card'
import type { CustomerPaymentViewModel } from '@/features/customer/view-models'

afterEach(() => cleanup())

const demoMovement: CustomerPaymentViewModel = {
  id: 'payment_test_only',
  jobId: 'job_demo_completed',
  kind: 'payment',
  serviceLabel: 'Mantenimiento preventivo',
  professionalName: 'Profesional de demostración',
  status: 'approved',
  statusView: { label: 'Pago confirmado', tone: 'success' },
  amount: 35000,
  createdAt: '2026-08-19T18:00:00.000Z',
  methodLabel: 'Visa terminada en 4242',
  receiptAvailable: true
}

const refundMovement: CustomerPaymentViewModel = {
  ...demoMovement,
  id: 'refund_test_only',
  kind: 'refund',
  status: 'refunded',
  statusView: { label: 'Devolución confirmada', tone: 'success' },
  amount: 5000
}

describe('customer payments center', () => {
  it('explains the protected flow while keeping the real movement list empty', () => {
    render(<CustomerPaymentsCenter movements={[]} integrationState="deferred" />)

    expect(screen.getByRole('heading', { name: 'Tus pagos tendrán un circuito protegido' })).toBeTruthy()
    expect(screen.getByText('La integración de Mercado Pago se incorporará en la etapa final')).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Proceso de pago y respaldo' }).children).toHaveLength(4)
    expect(screen.getByText('Todavía no hay movimientos')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Consultar movimientos' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Abrir chat' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('link', { name: 'Ir al centro de ayuda' })).toBeTruthy()
    expect(screen.queryByText(/^Pago aprobado$/i)).toBeNull()
    expect(screen.queryByText('payment_test_only')).toBeNull()
  })

  it('renders customer-safe movement data without enabling receipts or refunds', () => {
    render(<PaymentMovementCard movement={demoMovement} />)

    expect(screen.getByText('Pago')).toBeTruthy()
    expect(screen.getByText('Mantenimiento preventivo')).toBeTruthy()
    expect(screen.getByText('Profesional de demostración')).toBeTruthy()
    expect(screen.getByText('Visa terminada en 4242')).toBeTruthy()
    expect(screen.getByText('$ 35.000')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Ver comprobante' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Solicitar devolución' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText('job_demo_completed')).toBeNull()
    expect(screen.queryByText(/4242\s*\d{4}/)).toBeNull()
  })

  it('distinguishes refunds without presenting another refund action', () => {
    render(<PaymentMovementCard movement={refundMovement} />)

    expect(screen.getByText('Devolución')).toBeTruthy()
    expect(screen.getByText('-$ 5.000')).toBeTruthy()
    expect(screen.getByText('Devolución confirmada')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Ver comprobante' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Ver detalle' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Solicitar devolución' })).toBeNull()
    expect(screen.queryByText('job_demo_completed')).toBeNull()
  })

  it('covers loading and recoverable error states', () => {
    const retry = vi.fn()
    const { rerender } = render(<CustomerPaymentsCenter movements={[]} integrationState="deferred" state="loading" />)
    expect(screen.getByRole('status').textContent).toContain('Cargando pagos')

    rerender(<CustomerPaymentsCenter movements={[]} integrationState="deferred" state="error" onRetry={retry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})
