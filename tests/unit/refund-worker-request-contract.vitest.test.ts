import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const dispatchRefunds = vi.hoisted(() => vi.fn(async () => ({ processed: 0 })))
vi.mock('@/lib/payments/refund-server', () => ({ dispatchRefunds }))

beforeEach(() => {
  vi.resetModules()
  dispatchRefunds.mockClear()
  vi.stubEnv('REFUND_WORKER_ENABLED', 'true')
  vi.stubEnv('REFUND_WORKER_SECRET', 'r'.repeat(48))
})
afterEach(() => vi.unstubAllEnvs())

it('rejects an outbox-only safety flag before executing financial work', async () => {
  const { POST } = await import('@/app/api/internal/refunds/route')
  const request = (body: object) => new Request('https://app.lysto.test/api/internal/refunds', {
    method: 'POST',
    headers: { authorization: `Bearer ${'r'.repeat(48)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  expect((await POST(request({ batchSize: 2, inAppOnly: true }))).status).toBe(503)
  expect(dispatchRefunds).not.toHaveBeenCalled()
  expect((await POST(request({ batchSize: 2 }))).status).toBe(200)
  expect(dispatchRefunds).toHaveBeenCalledWith(2)
})
