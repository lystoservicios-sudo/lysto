import { describe, expect, it, vi } from 'vitest'
import {
  listNotificationDeliveries,
  retryNotificationDelivery
} from '../../lib/notifications/operations'
import type { Session } from '../../lib/auth/session'

const item = {
  id: '11111111-1111-4111-8111-111111111111',
  eventType: 'job.assigned',
  channel: 'in_app',
  createdAt: '2026-09-12T12:00:00Z',
  availableAt: '2026-09-12T12:01:00Z',
  attemptCount: 2,
  maxAttempts: 8,
  state: 'queued',
  lastError: 'provider_http_503',
  providerAccepted: false,
  version: 3
}
function session(data: unknown, permissions = ['operations'] as string[]) {
  return {
    role: 'admin',
    assuranceLevel: 'aal2',
    profileId: '22222222-2222-4222-8222-222222222222',
    permissions,
    client: { rpc: vi.fn(async () => ({ data, error: null })) }
  }
}
const actualSession = (value: ReturnType<typeof session>) => value as unknown as Session
describe('notification operations service', () => {
  it('returns a bounded sanitized page and scoped cursor', async () => {
    const current = session({
      items: [item],
      total: 1,
      counts: { queued: 1, leased: 0, processed: 0, deadLetter: 0, suppressed: 0, manual: 0 }
    })
    const result = await listNotificationDeliveries(actualSession(current), { pageSize: 20 })
    expect(result.items).toEqual([item])
    expect(result.total).toBe(1)
    expect(JSON.stringify(result)).not.toContain('recipient')
  })
  it('requires operations MFA before database access', async () => {
    for (const current of [
      session({}, []),
      { ...session({}), assuranceLevel: 'aal1' },
      { ...session({}), role: 'customer' }
    ])
      await expect(listNotificationDeliveries(actualSession(current))).rejects.toMatchObject({
        code: 'forbidden'
      })
  })
  it('requires version and a meaningful reason for a dead-letter retry', async () => {
    const current = session({ ...item, state: 'queued' })
    await expect(
      retryNotificationDelivery(actualSession(current), {
        eventId: item.id,
        expectedVersion: 0,
        reason: 'short'
      })
    ).rejects.toBeTruthy()
    await retryNotificationDelivery(actualSession(current), {
      eventId: item.id,
      expectedVersion: 3,
      reason: 'Proveedor corregido y revisado'
    })
    expect(current.client.rpc).toHaveBeenCalledWith('retry_outbox_delivery', {
      p_event_id: item.id,
      p_expected_revision: 3,
      p_reason: 'Proveedor corregido y revisado'
    })
  })
  it('fails closed on malformed database rows', async () => {
    await expect(
      listNotificationDeliveries(
        actualSession(
          session({
            items: [{ ...item, recipientEmail: 'secret@example.test' }],
            total: 1,
            counts: {}
          })
        )
      )
    ).rejects.toMatchObject({ code: 'service_unavailable' })
  })
})
