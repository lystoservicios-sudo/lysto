import { expect, it } from 'vitest'
import { customerCheckoutProjection } from '@/lib/payments/customer-projection'

it('keeps the payment status and customer total while excluding the internal split', () => {
  const row = { id: 'checkout', job_id: 'job', extra_id: null, amount: '100000.00', marketplace_fee: '20000',
    professional_amount: '80000', status: 'approved', live_mode: true, expires_at: '2027-01-10',
    review_reason: 'internal_note', created_at: '2027-01-09', checkout_protocol: 'orders',
    observations: [{ paymentId: 'mp', status: 'approved', providerFee: 6000, netReceived: 74000, refunded: 0 }] }
  const projected = customerCheckoutProjection(row)
  expect(projected).toMatchObject({ id: 'checkout', amount: '100000.00', status: 'approved' })
  expect(projected).not.toHaveProperty('marketplace_fee')
  expect(projected).not.toHaveProperty('professional_amount')
  expect(projected.observations).toEqual([{ paymentId: 'mp', status: 'approved', refunded: 0 }])
  expect(projected.review_reason).toBeNull()
})
