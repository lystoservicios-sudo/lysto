import { describe, expect, it } from 'vitest'

import {
  customerPaymentFilters,
  paymentListInput,
  paymentRecordAvailable,
  paymentState,
  refundState,
  paymentRecordText
} from '@/lib/customer-more/payments-model'

describe('customer payment presentation', () => {
  it('limits filters and pagination to bounded supported values', () => {
    expect(paymentListInput({ estado: 'procesando', pagina: '2' })).toEqual({ filter: 'procesando', page: 2, pageSize: 20 })
    expect(paymentListInput({ estado: 'provider_secret', pagina: '-1' })).toEqual({ filter: 'todos', page: 1, pageSize: 20 })
    expect(paymentListInput({ pagina: '999999999999' }).page).toBe(1)
    expect(customerPaymentFilters.map((filter) => filter.value)).toEqual(['todos', 'pendientes', 'procesando', 'pagados', 'reintegros'])
  })

  it('never calls a payment confirmed from a redirect, pending state, or unknown state', () => {
    expect(paymentState('pending').label).toBe('Esperando confirmación')
    expect(paymentState('review').description).toContain('No vuelvas a pagar')
    expect(paymentState('retorno').label).toBe('Estado por verificar')
    expect(paymentState(null).label).toBe('Pendiente de pago')
    expect(paymentState('approved').label).toBe('Pago confirmado')
  })

  it('shows expired checkout links accurately without regressing canonical pending or confirmed states', () => {
    const now = Date.parse('2026-10-16T12:00:00Z')
    for (const status of ['ready', 'creating', 'rejected', 'cancelled']) {
      expect(paymentState(status, '2026-10-15T12:00:00Z', now)).toMatchObject({ label: 'Enlace vencido', tone: 'neutral' })
      expect(paymentState(status, '2026-10-16T12:00:00Z', now).label).toBe('Enlace vencido')
    }
    for (const status of ['approved', 'pending', 'in_process', 'review', 'refunded', 'partially_refunded']) {
      expect(paymentState(status, '2026-10-15T12:00:00Z', now)).toEqual(paymentState(status))
    }
    expect(paymentState('ready', '2027-10-16T12:00:00Z', now).label).toBe('Pendiente de pago')
    expect(paymentState(null, null, now).label).toBe('Pendiente de pago')
  })

  it('issues payment records only for canonical real confirmed states with a provider reference', () => {
    for (const status of ['creating', 'ready', 'pending', 'in_process', 'review', 'rejected', 'charged_back']) {
      expect(paymentRecordAvailable({ status, liveMode: true, providerReferences: ['123'] })).toBe(false)
    }
    expect(paymentRecordAvailable({ status: 'approved', liveMode: false, providerReferences: ['123'] })).toBe(false)
    expect(paymentRecordAvailable({ status: 'approved', liveMode: true, providerReferences: [] })).toBe(false)
    for (const status of ['approved', 'refunded', 'partially_refunded']) {
      expect(paymentRecordAvailable({ status, liveMode: true, providerReferences: ['123'] })).toBe(true)
    }
  })

  it('describes actual refund execution without promising approval or settlement', () => {
    expect(refundState('requested').label).toBe('Reintegro solicitado')
    expect(refundState('processing').description).toContain('procesando')
    expect(refundState('succeeded').description).toContain('acreditación')
    expect(refundState('failed').label).toBe('Necesita revisión')
  })

  it('downloads an explicit non-fiscal payment record without financial internals', () => {
    const text = paymentRecordText({
      jobId: 'job-1', checkoutId: 'checkout-1', service: 'Mantenimiento',
      amount: 1000, refundedAmount: 100, status: 'partially_refunded',
      createdAt: '2026-10-14T18:00:00Z', updatedAt: '2026-10-14T18:30:00Z',
      providerReferences: ['123456'], extraLabel: null
    })
    expect(text).toContain('Registro de pago')
    expect(text).toContain('No es una factura fiscal')
    expect(text).toContain('123456')
    expect(text).toContain('Reintegro confirmado')
    expect(text).not.toMatch(/marketplace_fee|providerFee|seller_account|82%|18%/)
  })
})
