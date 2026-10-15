// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { runOutboxBatch } from '@/lib/notifications/worker'
const id = '60000000-0000-4000-8000-000000000001', token = '60000000-0000-4000-8000-000000000002'
const snapshot = { idempotencyKey: `lysto-${id}`, firstAttemptAt: '2026-10-15T01:00:00Z', content: { version: 'transactional-v1', from: 'Lysto <aviso@example.test>', to: 'ana@example.test', subject: 'Tu consulta', text: 'Novedad', html: '<p>Novedad</p>', url: 'https://lysto.test/app/ayuda' } }
function database(channel = 'email', gate: boolean[] = [false]) {
  return { rpc: vi.fn(async (name: string) => ({ error: null, data: name === 'claim_outbox_events' ? [{ id, claim_token: token, channel, attempt_count: 1, locked_until: '2099-01-01T00:00:00Z' }] : name === 'customer_outbox_email_allowed' ? gate.shift() : name === 'resolve_outbox_delivery' ? { recipientEmail: 'ana@example.test', context: {}, snapshot } : true })) }
}
const options = { appUrl: 'https://lysto.test', from: 'Lysto <aviso@example.test>', now: () => new Date('2026-10-15T01:10:00Z'), enforceCustomerPreferences: true }
it('suppresses opted-out email through the real fenced delivery operation before sending', async () => {
  const client = database(), sendEmail = vi.fn()
  const result = await runOutboxBatch(client, { ...options, sendEmail })
  expect(result.suppressed).toBe(1)
  expect(sendEmail).not.toHaveBeenCalled()
  expect(client.rpc).toHaveBeenCalledWith('stop_outbox_delivery', { p_event_id: id, p_claim_token: token, p_code: 'customer_preference', p_suppressed: true })
})
it('rechecks a changed preference immediately before a provider request', async () => {
  const client = database('email', [true, false]), sendEmail = vi.fn()
  const result = await runOutboxBatch(client, { ...options, sendEmail })
  expect(result.suppressed).toBe(1)
  expect(sendEmail).not.toHaveBeenCalled()
  expect(client.rpc.mock.calls.filter(([name]) => name === 'customer_outbox_email_allowed')).toHaveLength(2)
})
it('keeps in-app notifications independent of email opt-outs', async () => {
  const client = database('in_app'), sendEmail = vi.fn()
  expect(await runOutboxBatch(client, { ...options, sendEmail })).toMatchObject({ inApp: 1, suppressed: 0 })
  expect(client.rpc.mock.calls.some(([name]) => name === 'customer_outbox_email_allowed')).toBe(false)
})
