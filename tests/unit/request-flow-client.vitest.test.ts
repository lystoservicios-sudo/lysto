import { beforeEach, describe, expect, it } from 'vitest'
import { createRequestDraft } from '@/features/service-request/request-draft'
import { readRequestDraft, storeRequestDraft, readPendingPayment, storePendingPayment, futureVisitDays, paymentPresentation, safeCheckoutUrl, readRequestPhotos, storeRequestPhotos } from '@/features/service-request/request-flow-client'

const actor = '00000000-0000-4000-8000-000000000001'
beforeEach(() => window.sessionStorage.clear())
describe('actor-bound request recovery', () => {
  it('restores only the same actor draft without persisting a monetary quote', () => {
    const draft = createRequestDraft(actor)
    storeRequestDraft(draft)
    expect(readRequestDraft(actor)).toEqual(draft)
    expect(readRequestDraft('00000000-0000-4000-8000-000000000002')).toBeNull()
  })
  it('persists the exact payment command before a potentially ambiguous mutation', () => {
    const pending = { previewId: '00000000-0000-4000-8000-000000000003', commandId: '00000000-0000-4000-8000-000000000004', jobId: null, checkoutId: null }
    storePendingPayment(actor, pending)
    expect(readPendingPayment(actor)).toEqual({ payment: pending, error: '' })
    expect(readPendingPayment('00000000-0000-4000-8000-000000000002').payment).toBeNull()
  })
  it('blocks corrupted pending commands instead of creating a second job', () => {
    window.sessionStorage.setItem(`lysto:pedir:payment:${actor}`, '{}')
    expect(readPendingPayment(actor).error).toBeTruthy()
  })
  it.each([
    ['2026-10-25T15:00:00Z', '2026-10-28'],
    ['2026-10-26T15:00:00Z', '2026-10-29'],
    ['2026-10-30T15:00:00Z', '2026-11-04'],
    ['2026-10-31T15:00:00Z', '2026-11-04'],
    ['2026-10-14T01:00:00Z', '2026-10-16'],
    ['2026-12-31T20:00:00Z', '2027-01-05']
  ])('starts after three weekdays from Argentina day: %s -> %s', (now, earliest) => {
    expect(futureVisitDays(new Date(now))[0].value).toBe(earliest)
  })
  it('still offers weekends after the minimum notice has elapsed', () => {
    expect(futureVisitDays(new Date('2026-10-26T15:00:00Z')).map(day => day.value))
      .toEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
  })
  it('renders only canonical approval and keeps ready/payment-return unresolved', () => {
    expect(paymentPresentation('approved').title).toBe('Pago confirmado')
    expect(paymentPresentation('ready').title).not.toBe('Pago confirmado')
    expect(paymentPresentation(null).title).toBe('Estamos comprobando tu pago')
    expect(paymentPresentation('rejected').title).toBe('El pago no se completó')
  })
  it('rejects arbitrary redirect destinations and allows Mercado Pago secure checkout', () => {
    expect(safeCheckoutUrl('https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=abc')).toBeTruthy()
    expect(safeCheckoutUrl('https://www.mercadopago.com.ar.evil.test')).toBeNull()
    expect(safeCheckoutUrl('javascript:alert(1)')).toBeNull()
  })
  it('recovers only private verified photo identifiers and metadata for the same actor', () => {
    const photos = { $new: [{ intentId: '00000000-0000-4000-8000-000000000011', name: 'Aire.jpg', bytes: 2048 }] }
    storeRequestPhotos(actor, photos)
    expect(readRequestPhotos(actor)).toEqual(photos)
    expect(readRequestPhotos('00000000-0000-4000-8000-000000000002')).toEqual({})
    expect(window.sessionStorage.getItem(`lysto:pedir:photos:${actor}`)).not.toContain('signedUrl')
  })
})
