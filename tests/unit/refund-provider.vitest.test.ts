// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { executeMercadoPagoRefund } from '@/lib/payments/refund-provider'

beforeEach(() => vi.restoreAllMocks())

it('uses one stable idempotency key and verifies the returned refund and payment', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 77, payment_id: 99, amount: 12.5, status: 'approved' }))
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 77, payment_id: 99, amount: 12.5, status: 'approved' }))
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 99,
          status: 'partially_refunded',
          date_last_updated: '2026-09-12T15:00:00Z'
        })
      )
    )
  const result = await executeMercadoPagoRefund({
    providerPaymentId: '99',
    amount: 12.5,
    idempotencyKey: 'refund-key',
    accessToken: 'TEST-token',
    fetcher
  })
  expect(fetcher).toHaveBeenCalledTimes(3)
  expect(fetcher.mock.calls[0][1].headers['X-Idempotency-Key']).toBe('refund-key')
  expect(result.providerReference).toBe('77')
  expect(result.canonicalPayment.status).toBe('partially_refunded')
})

it('classifies timeouts and server responses as retryable', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }))
  await expect(
    executeMercadoPagoRefund({
      providerPaymentId: '99',
      amount: 12.5,
      idempotencyKey: 'refund-key',
      accessToken: 'TEST-token',
      fetcher
    })
  ).rejects.toMatchObject({ definitive: false })
})

it('rejects a mismatched provider response without marking success', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ id: 77, payment_id: 100, amount: 12.5, status: 'approved' }))
    )
  await expect(
    executeMercadoPagoRefund({
      providerPaymentId: '99',
      amount: 12.5,
      idempotencyKey: 'refund-key',
      accessToken: 'TEST-token',
      fetcher
    })
  ).rejects.toMatchObject({ definitive: false })
})
