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

it('refunds an Orders transaction with the same key and verifies the canonical order', async () => {
  const before = { id: 'ORDTST01ABC', total_amount: '100.00', transactions: {
    payments: [{ id: 'PAY01ABC', amount: '100.00' }], refunds: [] } }
  const after = { ...before, last_updated_date: '2026-09-20T12:20:00Z',
    transactions: { ...before.transactions, refunds: [{ id: 'REF01ABC', transaction_id: 'PAY01ABC', amount: '12.50', status: 'processed' }] } }
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(before)))
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: before.id, transactions: { refunds: after.transactions.refunds } })))
    .mockResolvedValueOnce(new Response(JSON.stringify(after)))
  const result = await executeMercadoPagoRefund({ orderId: before.id, providerPaymentId: 'PAY01ABC',
    amount: 12.5, paymentAmount: 100, idempotencyKey: 'stable-key', accessToken: 'TEST-token',
    persistOrderRefundBaseline: async ids => ids, fetcher })
  expect(fetcher.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
    '/v1/orders/ORDTST01ABC', '/v1/orders/ORDTST01ABC/refund', '/v1/orders/ORDTST01ABC'
  ])
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ transactions: [{ id: 'PAY01ABC', amount: '12.50' }] })
  expect(fetcher.mock.calls[1][1].headers['X-Idempotency-Key']).toBe('stable-key')
  expect(result.providerReference).toBe('REF01ABC')
})

it('recovers an Orders refund applied before a worker crash without repeating the POST', async () => {
  const canonical = { id: 'ORDTST01ABC', transactions: {
    payments: [{ id: 'PAY01ABC', amount: '100.00' }],
    refunds: [{ id: 'REF01ABC', transaction_id: 'PAY01ABC', amount: '12.50', status: 'processed' }]
  } }
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(canonical)))
  const result = await executeMercadoPagoRefund({ orderId: canonical.id,
    providerPaymentId: 'PAY01ABC', amount: 12.5, paymentAmount: 100,
    idempotencyKey: 'stable-key', accessToken: 'TEST-token',
    persistOrderRefundBaseline: async () => [], fetcher })
  expect(result.providerReference).toBe('REF01ABC')
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('does not issue an Orders refund without a durable baseline', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'ORDTST01ABC',
    transactions: { payments: [{ id: 'PAY01ABC', amount: '100.00' }], refunds: [] } })))
  await expect(executeMercadoPagoRefund({ orderId: 'ORDTST01ABC',
    providerPaymentId: 'PAY01ABC', amount: 12.5, paymentAmount: 100,
    idempotencyKey: 'stable-key', accessToken: 'TEST-token', fetcher }))
    .rejects.toMatchObject({ definitive: false })
  expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/refund'))).toBe(false)
})

it('recovers an Orders refund after a provider idempotency conflict', async () => {
  const before = { id: 'ORDTST01ABC', transactions: {
    payments: [{ id: 'PAY01ABC', amount: '100.00' }], refunds: [] } }
  const after = { ...before, transactions: { ...before.transactions,
    refunds: [{ id: 'REF01ABC', transaction_id: 'PAY01ABC', amount: '12.50', status: 'processed' }] } }
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(before)))
    .mockResolvedValueOnce(new Response('{}', { status: 409 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(after)))
  const result = await executeMercadoPagoRefund({ orderId: before.id,
    providerPaymentId: 'PAY01ABC', amount: 12.5, paymentAmount: 100,
    idempotencyKey: 'stable-key', accessToken: 'TEST-token',
    persistOrderRefundBaseline: async ids => ids, fetcher })
  expect(result.providerReference).toBe('REF01ABC')
  expect(fetcher).toHaveBeenCalledTimes(3)
})
