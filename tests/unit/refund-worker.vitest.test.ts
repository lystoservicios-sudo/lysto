// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { runRefundBatch } from '@/lib/payments/refund-service'

const claim = {
  request_id: '11111111-1111-4111-8111-111111111111',
  payment_id: '22222222-2222-4222-8222-222222222222',
  amount: 3500,
  currency: 'ARS',
  reason: 'Cancelación aprobada por finanzas',
  provider_payment_id: '987654321',
  provider_idempotency_key: '11111111-1111-4111-8111-111111111111',
  claim_token: '33333333-3333-4333-8333-333333333333',
  attempt_count: 1,
  locked_until: '2026-09-12T15:05:00.000Z',
  status: 'processing'
}

function database() {
  const rpc = vi.fn(async (name: string) => {
    if (name === 'claim_payment_refund_requests') return { data: [claim], error: null }
    if (name === 'get_payment_refund_execution_context')
      return {
        data: {
          professionalId: '44444444-4444-4444-8444-444444444444',
          checkoutId: '55555555-5555-4555-8555-555555555555',
          paymentAmount: 7000
        },
        error: null
      }
    return { data: { status: 'succeeded' }, error: null }
  })
  return { rpc }
}

describe('refund worker', () => {
  it('finalizes only after a verified provider refund and canonical reconciliation', async () => {
    const db = database()
    const order: string[] = []
    const execute = vi.fn(async () => {
      order.push('provider')
      return { providerReference: 'refund-77', canonicalPayment: { id: 987654321 } }
    })
    const applyCanonical = vi.fn(async () => order.push('canonical'))

    const result = await runRefundBatch(db, {
      batchSize: 1,
      now: () => new Date('2026-09-12T15:00:00.000Z'),
      execute,
      applyCanonical
    })

    expect(result).toEqual({ claimed: 1, succeeded: 1, retrying: 0, failed: 0, lostClaims: 0 })
    expect(order).toEqual(['provider', 'canonical'])
    expect(db.rpc).toHaveBeenLastCalledWith('finalize_payment_refund_request', {
      p_request_id: claim.request_id,
      p_claim_token: claim.claim_token,
      p_provider_reference: 'refund-77'
    })
  })

  it('keeps an ambiguous provider result retryable with the same idempotency key', async () => {
    const db = database()
    const execute = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('provider_timeout'), { definitive: false }))

    const result = await runRefundBatch(db, {
      batchSize: 1,
      now: () => new Date('2026-09-12T15:00:00.000Z'),
      execute,
      applyCanonical: vi.fn()
    })

    expect(result.retrying).toBe(1)
    expect(db.rpc).toHaveBeenLastCalledWith(
      'fail_payment_refund_request',
      expect.objectContaining({
        p_request_id: claim.request_id,
        p_claim_token: claim.claim_token,
        p_is_definitive: false
      })
    )
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        provider_idempotency_key: claim.provider_idempotency_key
      }),
      expect.any(Object)
    )
  })

  it('does not contact the provider after the lease has expired', async () => {
    const db = database()
    const execute = vi.fn()
    const result = await runRefundBatch(db, {
      batchSize: 1,
      now: () => new Date('2026-09-12T15:06:00.000Z'),
      execute,
      applyCanonical: vi.fn()
    })
    expect(execute).not.toHaveBeenCalled()
    expect(result.lostClaims).toBe(1)
  })
})
