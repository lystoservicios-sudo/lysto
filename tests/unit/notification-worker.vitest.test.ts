import { expect, it, vi } from 'vitest'
import { runOutboxBatch } from '../../lib/notifications/worker'

const id = '11111111-1111-4111-8111-111111111111',
  token = '22222222-2222-4222-8222-222222222222'
const event = {
  id,
  claim_token: token,
  channel: 'email',
  attempt_count: 1,
  locked_until: '2099-01-01T00:00:00Z'
}
const snapshot = {
  idempotencyKey: `lysto-outbox-${id}`,
  firstAttemptAt: '2026-09-12T00:00:00Z',
  content: {
    version: 'transactional-v1',
    from: 'Lysto <sender@example.test>',
    to: 'recipient@example.test',
    subject: 'Persistido',
    text: 'Original',
    html: '<p>Original</p>',
    url: 'https://example.test/pro/onboarding'
  }
}
const context = { eventType: 'professional.approved', aggregateId: id, audience: 'professional' }
function database(overrides: Record<string, unknown> = {}) {
  return {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      void args
      return {
        error: null,
        data:
          name in overrides
            ? overrides[name]
            : name === 'claim_outbox_events'
              ? [event]
              : name === 'resolve_outbox_delivery'
                ? { recipientEmail: snapshot.content.to, context, snapshot }
                : true
      }
    })
  }
}
const options = {
  appUrl: 'https://example.test',
  from: 'Lysto <changed@example.test>',
  batchSize: 1,
  workerId: 'test-worker',
  now: () => new Date('2026-09-12T01:00:00Z')
}
it('reuses the persisted body and awaits provider acceptance before ACK', async () => {
  const db = database()
  const send = vi.fn(async (sentSnapshot: typeof snapshot) => {
    void sentSnapshot
    return { accepted: true as const, providerMessageId: 'provider-1' }
  })
  expect(await runOutboxBatch(db, { ...options, sendEmail: send })).toMatchObject({
    accepted: 1,
    failed: 0
  })
  expect(send.mock.calls[0][0]).toEqual(snapshot)
  expect(db.rpc.mock.calls.at(-1)).toEqual([
    'finish_email_delivery',
    { p_event_id: id, p_claim_token: token, p_provider_message_id: 'provider-1' }
  ])
})
it('leaves email queued when no email transport is enabled', async () => {
  const db = database({ claim_outbox_events: [] })
  await runOutboxBatch(db, options)
  expect(db.rpc.mock.calls[0][1]).toMatchObject({ p_channels: ['in_app'] })
})
it('retries a transient provider failure through the fenced FAIL operation', async () => {
  const db = database()
  const result = await runOutboxBatch(db, {
    ...options,
    sendEmail: async () => ({ accepted: false, retryable: true, code: 'provider_http_429' })
  })
  expect(result.failed).toBe(1)
  expect(db.rpc.mock.calls.at(-1)).toEqual([
    'fail_outbox_event',
    {
      p_event_id: id,
      p_claim_token: token,
      p_error: 'provider_http_429',
      p_retry_at: '2026-09-12T01:01:00.000Z'
    }
  ])
})
it('quarantines uncertain delivery beyond the safe deduplication window', async () => {
  const db = database()
  const send = vi.fn()
  expect(
    (
      await runOutboxBatch(db, {
        ...options,
        now: () => new Date('2026-09-14T00:00:00Z'),
        sendEmail: send
      })
    ).failed
  ).toBe(1)
  expect(send).not.toHaveBeenCalled()
  expect(db.rpc.mock.calls.at(-1)?.[0]).toBe('stop_outbox_delivery')
})
it('does not confirm another worker’s claim after a crash or reclamation', async () => {
  const db = database({ finish_email_delivery: false })
  const result = await runOutboxBatch(db, {
    ...options,
    sendEmail: async () => ({ accepted: true, providerMessageId: 'provider-1' })
  })
  expect(result).toMatchObject({ accepted: 0, lostClaims: 1 })
})
it('does not start network delivery with an expired lease', async () => {
  const db = database({ claim_outbox_events: [{ ...event, locked_until: '2026-09-12T00:00:00Z' }] })
  const send = vi.fn()
  expect((await runOutboxBatch(db, { ...options, sendEmail: send })).lostClaims).toBe(1)
  expect(send).not.toHaveBeenCalled()
})
it('suppresses an email that becomes stale immediately before provider delivery', async () => {
  let resolutions = 0
  const db = {
    rpc: vi.fn(async (name: string) => {
      if (name === 'claim_outbox_events') return { data: [event], error: null }
      if (name === 'resolve_outbox_delivery') {
        resolutions++
        if (resolutions === 2) return { data: null, error: { code: '22023' } }
        return {
          data: { recipientEmail: snapshot.content.to, context, snapshot },
          error: null
        }
      }
      return { data: true, error: null }
    })
  }
  const send = vi.fn()
  expect(await runOutboxBatch(db, { ...options, sendEmail: send })).toMatchObject({
    accepted: 0,
    suppressed: 1,
    failed: 0
  })
  expect(send).not.toHaveBeenCalled()
  expect(db.rpc.mock.calls.at(-1)).toEqual([
    'stop_outbox_delivery',
    {
      p_event_id: id,
      p_claim_token: token,
      p_code: 'recipient_unavailable',
      p_suppressed: true
    }
  ])
})
