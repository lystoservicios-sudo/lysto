import { describe, expect, it, vi } from 'vitest'
import { sendTransactionalEmail } from '../../lib/notifications/provider'

const message = {
  from: 'Lysto <avisos@example.test>',
  to: 'customer@example.test',
  subject: 'Aviso',
  text: 'Texto',
  html: '<p>Texto</p>'
}
const options = {
  apiKey: 'private-test-key',
  idempotencyKey: 'lysto-outbox-11111111-1111-4111-8111-111111111111',
  firstAttemptAt: '2026-09-12T00:00:00Z',
  now: new Date('2026-09-12T01:00:00Z')
}

describe('transactional email provider boundary', () => {
  it('uses the fixed endpoint and stable content/key on a repeated attempt', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }))
    expect(await sendTransactionalEmail(message, { ...options, fetcher })).toEqual({
      accepted: true,
      providerMessageId: 'email-123'
    })
    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers['Idempotency-Key']).toBe(options.idempotencyKey)
    expect(JSON.parse(init.body)).toEqual({ ...message, to: [message.to] })
    expect(init.redirect).toBe('error')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
  it.each([429, 500, 503])(
    'retries status %s without exposing response secrets',
    async (status) => {
      const fetcher = vi
        .fn()
        .mockResolvedValue(new Response('private-token-recipient-body', { status }))
      const result = await sendTransactionalEmail(message, { ...options, fetcher })
      expect(result).toEqual({ accepted: false, retryable: true, code: `provider_http_${status}` })
    }
  )
  it('distinguishes concurrent idempotent requests from payload mismatch', async () => {
    for (const [name, retryable] of [
      ['concurrent_idempotent_requests', true],
      ['invalid_idempotent_request', false]
    ] as const) {
      const fetcher = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ name, message: 'secret' }), { status: 409 })
        )
      expect(await sendTransactionalEmail(message, { ...options, fetcher })).toEqual({
        accepted: false,
        retryable,
        code: retryable ? 'provider_concurrent_request' : 'provider_idempotency_conflict'
      })
    }
  })
  it('a timeout is uncertain and retryable within the deduplication window', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('recipient/token'))
    expect(await sendTransactionalEmail(message, { ...options, fetcher })).toEqual({
      accepted: false,
      retryable: true,
      code: 'provider_response_uncertain'
    })
  })
  it('does not resend after the provider deduplication window or with an invalid timestamp', async () => {
    const fetcher = vi.fn()
    for (const firstAttemptAt of ['invalid', '2026-09-10T00:00:00Z', '2026-09-13T00:00:00Z']) {
      expect(
        await sendTransactionalEmail(message, { ...options, firstAttemptAt, fetcher })
      ).toEqual({ accepted: false, retryable: false, code: 'provider_window_requires_review' })
    }
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('treats an invalid success response as uncertain rather than falsely confirming', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    expect(await sendTransactionalEmail(message, { ...options, fetcher })).toEqual({
      accepted: false,
      retryable: true,
      code: 'provider_response_uncertain'
    })
  })
  it('rejects malformed recipients and header injection before network use', async () => {
    const fetcher = vi.fn()
    for (const bad of [
      { ...message, to: 'wrong' },
      { ...message, subject: 'x\r\nBcc:secret@example.test' },
      { ...message, from: 'x\r\ny' }
    ]) {
      expect(await sendTransactionalEmail(bad, { ...options, fetcher })).toEqual({
        accepted: false,
        retryable: false,
        code: 'invalid_email_snapshot'
      })
    }
    expect(fetcher).not.toHaveBeenCalled()
  })
})
