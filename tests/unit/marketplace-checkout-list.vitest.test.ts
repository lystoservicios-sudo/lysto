// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ actor: vi.fn(), query: vi.fn() }))
vi.mock('@/lib/payments/marketplace-session', () => ({
  paymentActor: state.actor,
  visibleCheckout: vi.fn(),
}))
vi.mock('@/lib/payments/marketplace-db', () => ({
  paymentDatabase: () => ({ query: state.query }),
}))
vi.mock('@/lib/payments/marketplace', () => ({
  reconcileCheckout: vi.fn(),
  renewCheckout: vi.fn(),
}))

import { GET } from '@/app/api/mercadopago/checkouts/route'

const request = () => new Request('https://lysto.test/api/mercadopago/checkouts')

beforeEach(() => {
  vi.clearAllMocks()
  state.actor.mockResolvedValue({ role: 'admin', customerId: null, professionalId: null })
})

it('lists historical checkouts before the Orders schema is installed', async () => {
  const checkout = { id: 'historical-checkout', status: 'approved', observations: [] }
  state.query.mockRejectedValueOnce(Object.assign(
    new Error('column c.checkout_protocol does not exist'), { code: '42703' }
  )).mockResolvedValueOnce({ rows: [checkout] })

  const response = await GET(request())

  expect(response.status).toBe(200)
  expect((await response.json()).checkouts).toEqual([checkout])
  expect(state.query).toHaveBeenCalledTimes(2)
  expect(state.query.mock.calls[0][0]).toContain('c.checkout_protocol')
  expect(state.query.mock.calls[1][0]).not.toContain('checkout_protocol')
  expect(state.query.mock.calls[1][0]).toContain('public.marketplace_payment_observations')
  expect(state.query.mock.calls[1][1]).toEqual(state.query.mock.calls[0][1])
})

it('lists Orders checkouts through the migrated schema without retrying', async () => {
  const checkout = { id: 'order-checkout', checkout_protocol: 'orders', observations: [] }
  state.query.mockResolvedValueOnce({ rows: [checkout] })

  const response = await GET(request())

  expect(response.status).toBe(200)
  expect((await response.json()).checkouts).toEqual([checkout])
  expect(state.query).toHaveBeenCalledTimes(1)
  expect(state.query.mock.calls[0][0]).toContain('private.marketplace_order_observations')
})

it('retries when the Orders observations table is absent', async () => {
  state.query.mockRejectedValueOnce(Object.assign(
    new Error('relation private.marketplace_order_observations does not exist'), { code: '42P01' }
  )).mockResolvedValueOnce({ rows: [] })

  expect((await GET(request())).status).toBe(200)
  expect(state.query).toHaveBeenCalledTimes(2)
})

it('does not hide unrelated database failures behind the historical query', async () => {
  state.query.mockRejectedValueOnce(Object.assign(
    new Error('database unavailable'), { code: '08006' }
  ))

  const response = await GET(request())

  expect(response.status).not.toBe(200)
  expect(state.query).toHaveBeenCalledTimes(1)
})

it('does not retry an unrelated missing column', async () => {
  state.query.mockRejectedValueOnce(Object.assign(
    new Error('column c.status does not exist'), { code: '42703' }
  ))

  const response = await GET(request())

  expect(response.status).not.toBe(200)
  expect(state.query).toHaveBeenCalledTimes(1)
})
