import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomerPaymentDetail } from '@/lib/customer-more/payments'
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
import { MorePaymentActions } from '@/components/customer/more-payments/payment-actions'
import { CustomerPaymentsList, CustomerPaymentDetails, CustomerPaymentRecordView, CustomerRefundDetails } from '@/components/customer/more-payments/payment-views'

const jobId = 'd046d214-fb6d-48ab-81c0-7a7f0e630d48'
const checkoutId = 'ab8fc712-1cb5-49c3-9676-c37fd95793ab'
const customerId = 'fa55ddc2-4ed5-4c39-adf6-c73d95708b95'
const detail: CustomerPaymentDetail = {
  id: jobId, status: 'confirmed', service: 'Mantenimiento preventivo', professional: 'Walter G.', amount: 1000,
  scheduledDate: '2026-10-16', timeWindow: '09:00-12:00', createdAt: '2026-10-14T18:00:00Z', extras: [], serviceReceipt: null,
  checkouts: [{ id: checkoutId, extraId: null, extraLabel: null, amount: 1000, currency: 'ARS', status: 'approved', liveMode: true,
    createdAt: '2026-10-14T18:00:00Z', updatedAt: '2026-10-14T18:30:00Z', expiresAt: '2026-10-15T18:00:00Z',
    refundedAmount: 0, providerReferences: ['123456'], refunds: [] }]
}
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
beforeEach(() => { refresh.mockReset() })

describe('customer payment screens', () => {
  it('renders connected filters, actual movements, stable detail links and bounded pagination', () => {
    render(<CustomerPaymentsList data={{ filter: 'pendientes', page: 2, pageSize: 20, total: 45, hasNext: true, hasPrevious: true,
      items: [{ id: checkoutId, jobId, checkoutId, service: 'Mantenimiento preventivo', professional: 'Walter G.', amount: 1000,
        status: 'ready', liveMode: true, createdAt: '2026-10-14T18:00:00Z', expiresAt: '2027-10-14T18:00:00Z', extraLabel: null, hasRefund: false }] }} />)
    expect(screen.getByRole('link', { name: 'Pendientes' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: /Mantenimiento preventivo/ }).getAttribute('href')).toBe(`/app/pagos/${jobId}`)
    expect(screen.getByRole('link', { name: 'Siguiente' }).getAttribute('href')).toContain('pagina=3')
    expect(screen.getByRole('link', { name: 'Anterior' }).getAttribute('href')).toContain('estado=pendientes')
    expect(screen.queryByText(/comisión|82%|18%|prueba de reparto/i)).toBeNull()
  })

  it('shows a useful empty filter state without invented movements or a dead pay button', () => {
    render(<CustomerPaymentsList data={{ filter: 'reintegros', page: 1, pageSize: 20, total: 0, hasNext: false, hasPrevious: false, items: [] }} />)
    expect(screen.getByText('No hay reintegros registrados')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver todos los pagos' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Pagar/ })).toBeNull()
  })

  it('connects canonical paid detail, receipt, public service record and payment help', () => {
    render(<CustomerPaymentDetails customerId={customerId} detail={{ ...detail, serviceReceipt: { token: 'b3dc0cbd-b265-4e37-b5c0-21f58025a7b7' } }} />)
    expect(screen.getByRole('link', { name: /^Ver registro de pago/ }).getAttribute('href')).toBe(`/app/pagos/${jobId}/comprobante?checkoutId=${checkoutId}`)
    expect(screen.getByRole('link', { name: /^Ver comprobante del servicio/ }).getAttribute('href')).toContain('/comprobante/b3dc0cbd')
    expect(screen.getByRole('link', { name: /^Necesito ayuda con este pago/ }).getAttribute('href')).toContain(`jobId=${jobId}&category=payment`)
    expect(screen.queryByRole('button', { name: /^Pagar/ })).toBeNull()
  })

  it('does not offer a receipt or another payment for an unconfirmed payment', () => {
    render(<CustomerPaymentDetails customerId={customerId} detail={{ ...detail, checkouts: [{ ...detail.checkouts[0], status: 'pending' }] }} />)
    expect(screen.getByText(/No vuelvas a pagar mientras se verifica/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /^Ver registro de pago/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Pagar/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Consultar estado' })).toBeTruthy()
  })

  it('consults canonical state only on an explicit action and refreshes server data', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ updated: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    render(<MorePaymentActions customerId={customerId} jobId={jobId} jobStatus="confirmed" amount={1000} checkout={{ id: checkoutId, status: 'pending', expiresAt: '2027-10-15T18:00:00Z', liveMode: true }} />)
    expect(fetcher).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Consultar estado' }))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ checkoutId, action: 'reconcile' })
    expect(fetcher.mock.calls[0][0]).toBe('/api/mercadopago/checkouts')
    expect(fetcher.mock.calls[0][1].headers['X-Lysto-Customer-Id']).toBe(customerId)
  })

  it('prepares a payment using only job/extra identifiers, never amounts or seller data', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ alreadyPaid: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    render(<MorePaymentActions customerId={customerId} jobId={jobId} jobStatus="confirmed" amount={1000} extraId="extra-1" />)
    fireEvent.click(screen.getByRole('button', { name: /Pagar/ }))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ jobId, extraId: 'extra-1' })
    expect(fetcher.mock.calls[0][0]).toBe('/api/mercadopago/create-preference')
    expect(fetcher.mock.calls[0][1].headers['X-Lysto-Customer-Id']).toBe(customerId)
  })

  it('cannot pay cancelled jobs, expired links, or previously refunded services', () => {
    for (const patch of [{ jobStatus: 'cancelled_by_customer' }, { jobStatus: 'disputed' }, { jobStatus: 'warranty_claim' }, { checkout: { id: checkoutId, status: 'ready', expiresAt: '2020-10-15T18:00:00Z', liveMode: true } }, { checkout: { id: checkoutId, status: 'refunded', expiresAt: '2027-10-15T18:00:00Z', liveMode: true } }, { checkout: { id: checkoutId, status: 'ready', expiresAt: '2027-10-15T18:00:00Z', liveMode: true, closedForNewPayments: true } }]) {
      const ui = render(<MorePaymentActions customerId={customerId} jobId={jobId} jobStatus="confirmed" amount={1000} {...patch} />)
      expect(screen.queryByRole('button', { name: /^Pagar/ })).toBeNull()
      ui.unmount()
    }
  })

  it('does not offer a payment when there is no accepted quote enabling checkout', () => {
    render(<CustomerPaymentDetails customerId={customerId} detail={{ ...detail, checkouts: [], canStartPayment: false }} />)
    expect(screen.queryByRole('button', { name: /^Pagar/ })).toBeNull()
    expect(screen.getByText(/Necesitás un presupuesto aceptado/)).toBeTruthy()
  })

  it('labels expired payment links consistently in movement list and service payment detail', () => {
    const list = render(<CustomerPaymentsList data={{ filter: 'todos', page: 1, pageSize: 20, total: 1, hasNext: false, hasPrevious: false,
      items: [{ id: checkoutId, jobId, checkoutId, service: detail.service, professional: detail.professional, amount: 1000,
        status: 'ready', liveMode: true, createdAt: detail.createdAt, expiresAt: '2020-10-14T18:00:00Z', extraLabel: null, hasRefund: false }] }} />)
    expect(screen.getByText('Enlace vencido')).toBeTruthy()
    expect(screen.queryByText('Pendiente de pago')).toBeNull()
    list.unmount()
    render(<CustomerPaymentDetails customerId={customerId} detail={{ ...detail, canStartPayment: true, checkouts: [{ ...detail.checkouts[0], status: 'rejected', expiresAt: '2020-10-14T18:00:00Z' }] }} />)
    expect(screen.getByText('Enlace vencido')).toBeTruthy()
    expect(screen.queryByText(/volver a intentarlo/)).toBeNull()
    expect(screen.queryByRole('button', { name: /^Pagar/ })).toBeNull()
  })

  it('recovers provider errors without marking a payment approved', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'No se pudo consultar el pago.' }), { status: 503 })))
    render(<MorePaymentActions customerId={customerId} jobId={jobId} jobStatus="confirmed" amount={1000} checkout={{ id: checkoutId, status: 'review', expiresAt: '2027-10-15T18:00:00Z', liveMode: true }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Consultar estado' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('presents printable/downloadable payment metadata explicitly as non-fiscal', () => {
    render(<CustomerPaymentRecordView record={{ jobId, checkoutId, service: detail.service, amount: 1000, refundedAmount: 0,
      status: 'approved', createdAt: detail.createdAt, updatedAt: detail.createdAt, providerReferences: ['123456'], extraLabel: null }} />)
    expect(screen.getByText(/No es una factura fiscal/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Descargar registro' }).getAttribute('href')).toContain(`/api/customer/payments/${jobId}/record?checkoutId=${checkoutId}`)
    expect(screen.getByRole('button', { name: 'Imprimir o guardar PDF' })).toBeTruthy()
    const printer = vi.spyOn(window, 'print').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir o guardar PDF' }))
    expect(printer).toHaveBeenCalledOnce()
    printer.mockRestore()
  })

  it('shows an actual refund request without self-approval controls', () => {
    render(<CustomerRefundDetails data={{ jobId, service: detail.service, checkoutId, paymentAmount: 1000,
      refund: { id: 'refund-1', amount: 100, status: 'requested', reason: 'Cancelación', providerReference: null,
        requestedAt: detail.createdAt, updatedAt: detail.createdAt } }} />)
    expect(screen.getByText('Reintegro solicitado')).toBeTruthy()
    expect(screen.getByText(/Todavía no hay una devolución confirmada/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Aprobar|Ejecutar|Reembolsar/i })).toBeNull()
  })
})
