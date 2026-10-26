import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const dispatchNotifications = vi.fn(async (batchSize: number) => ({
  accepted: batchSize,
  failed: 0
}))

vi.mock('../../lib/notifications/server', () => ({ dispatchNotifications }))

beforeEach(() => {
  vi.resetModules()
  dispatchNotifications.mockClear()
  process.env.OUTBOX_WORKER_ENABLED = 'true'
  process.env.CRON_SECRET = 'c'.repeat(48)
  process.env.OUTBOX_WORKER_SECRET = 's'.repeat(48)
})

afterEach(() => {
  delete process.env.OUTBOX_WORKER_ENABLED
  delete process.env.CRON_SECRET
  delete process.env.OUTBOX_WORKER_SECRET
})

it('runs one bounded batch for an authenticated Vercel cron invocation', async () => {
  const { GET } = await import('../../app/api/internal/outbox/route')
  const response = await GET(
    new Request('https://app.lysto.test/api/internal/outbox', {
      headers: { authorization: `Bearer ${'c'.repeat(48)}` }
    })
  )

  expect(response.status).toBe(200)
  expect(dispatchNotifications).toHaveBeenCalledWith(5)
})

it('rejects a missing, wrong, short or disabled cron credential', async () => {
  const { GET } = await import('../../app/api/internal/outbox/route')
  for (const authorization of [null, `Bearer ${'x'.repeat(48)}`, 'Bearer short']) {
    const headers = authorization ? { authorization } : undefined
    expect(
      (
        await GET(new Request('https://app.lysto.test/api/internal/outbox', { headers }))
      ).status
    ).toBe(403)
  }
  process.env.OUTBOX_WORKER_ENABLED = 'false'
  expect(
    (
      await GET(
        new Request('https://app.lysto.test/api/internal/outbox', {
          headers: { authorization: `Bearer ${'c'.repeat(48)}` }
        })
      )
    ).status
  ).toBe(403)
  expect(dispatchNotifications).not.toHaveBeenCalled()
})

it('restricts the authenticated scheduler POST to internal notifications when requested', async () => {
  const { POST } = await import('../../app/api/internal/outbox/route')
  const response = await POST(new Request('https://app.lysto.test/api/internal/outbox', {
    method: 'POST',
    headers: { authorization: `Bearer ${'s'.repeat(48)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchSize: 5, inAppOnly: true })
  }))
  expect(response.status).toBe(200)
  expect(dispatchNotifications).toHaveBeenCalledWith(5, undefined, { inAppOnly: true })
})

it('preserves the existing POST mode and rejects a request without the worker credential', async () => {
  const { POST } = await import('../../app/api/internal/outbox/route')
  const request = (authorized: boolean) => new Request('https://app.lysto.test/api/internal/outbox', {
    method: 'POST',
    headers: { ...(authorized ? { authorization: `Bearer ${'s'.repeat(48)}` } : {}), 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchSize: 2 })
  })
  expect((await POST(request(false))).status).toBe(403)
  expect(dispatchNotifications).not.toHaveBeenCalled()
  expect((await POST(request(true))).status).toBe(200)
  expect(dispatchNotifications).toHaveBeenCalledWith(2)
})
