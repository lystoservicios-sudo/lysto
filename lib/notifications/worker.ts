import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { renderOutboxNotification } from './delivery-template'
import { EMAIL_RETRY_WINDOW_MS, emailSnapshotSchema, type EmailResult } from './provider'

export type OutboxRpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { code?: string } | null }>
}
const claimSchema = z.object({
  id: z.string().uuid(),
  claim_token: z.string().uuid(),
  channel: z.enum(['in_app', 'email']),
  attempt_count: z.number().int().positive(),
  locked_until: z.string().datetime({ offset: true })
})
const snapshotSchema = z.object({
  idempotencyKey: z.string().min(1).max(256),
  firstAttemptAt: z.string().datetime({ offset: true }),
  content: emailSnapshotSchema.extend({
    version: z.enum(['transactional-v1', 'transactional-v2']),
    url: z.string().url()
  })
})
export type DeliverySnapshot = z.infer<typeof snapshotSchema>
export type OutboxOptions = {
  appUrl: string
  from: string
  batchSize?: number
  invitationId?: string
  workerId?: string
  now?: () => Date
  sendEmail?: (snapshot: DeliverySnapshot) => Promise<EmailResult>
}
class DeliveryDatabaseError extends Error {
  constructor(readonly code?: string) {
    super('notification_database_error')
  }
}

/** All work is awaited. A process crash leaves a recoverable lease and snapshot. */
export async function runOutboxBatch(client: OutboxRpcClient, options: OutboxOptions) {
  const now = options.now ?? (() => new Date()),
    started = Date.now()
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.rpc(name, args)
    if (result.error) throw new DeliveryDatabaseError(result.error.code)
    return result.data
  }
  const batchSize = z
    .number()
    .int()
    .min(1)
    .max(5)
    .parse(options.batchSize ?? 5)
  const events = z
    .array(claimSchema)
    .max(5)
    .parse(
      options.invitationId
        ? await call('claim_professional_invitation_event', {
            p_invitation_id: options.invitationId,
            p_worker_id: options.workerId ?? `outbox-${randomUUID()}`,
            p_lease_seconds: 120
          })
        : await call('claim_outbox_events', {
            p_worker_id: options.workerId ?? `outbox-${randomUUID()}`,
            p_batch_size: batchSize,
            p_lease_seconds: 120,
            p_channels: options.sendEmail ? ['in_app', 'email'] : ['in_app']
          })
    )
  const result = {
    claimed: events.length,
    accepted: 0,
    inApp: 0,
    suppressed: 0,
    failed: 0,
    lostClaims: 0
  }
  for (const event of events) {
    const args = { p_event_id: event.id, p_claim_token: event.claim_token }
    const fail = async (code: string, retryable: boolean) => {
      if (retryable)
        await call('fail_outbox_event', {
          ...args,
          p_error: code,
          p_retry_at: new Date(
            now().getTime() + Math.min(3600000, 60000 * 2 ** Math.min(event.attempt_count - 1, 6))
          ).toISOString()
        })
      else await call('stop_outbox_delivery', { ...args, p_code: code, p_suppressed: false })
      result.failed++
    }
    if (Date.parse(event.locked_until) <= now().getTime()) {
      result.lostClaims++
      continue
    }
    if (Date.now() - started > 30000) {
      await fail('worker_duration_budget', true)
      continue
    }
    try {
      const delivery = z
        .object({
          recipientEmail: z.string().email(),
          context: z.unknown(),
          snapshot: z.unknown().nullable()
        })
        .parse(await call('resolve_outbox_delivery', args))
      let sealed = delivery.snapshot
      if (!sealed) {
        const notice = renderOutboxNotification(delivery.context, options.appUrl)
        sealed = await call('seal_outbox_delivery', {
          ...args,
          p_content: { ...notice, from: options.from, to: delivery.recipientEmail }
        })
      }
      const snapshot = snapshotSchema.parse(sealed)
      if (event.channel === 'in_app') {
        if (await call('finish_in_app_delivery', args)) result.inApp++
        else result.lostClaims++
        continue
      }
      const age = now().getTime() - Date.parse(snapshot.firstAttemptAt)
      if (age < 0 || age >= EMAIL_RETRY_WINDOW_MS) {
        await fail('provider_window_requires_review', false)
        continue
      }
      // Revalidate after preparation, immediately before touching the provider.
      await call('resolve_outbox_delivery', args)
      if (Date.parse(event.locked_until) - now().getTime() < 10000) {
        await fail('delivery_lease_too_short', true)
        continue
      }
      if (!options.sendEmail) {
        await fail('email_transport_disabled', true)
        continue
      }
      const sent = await options.sendEmail(snapshot)
      if (!sent.accepted) {
        await fail(sent.code, sent.retryable)
        continue
      }
      if (
        await call('finish_email_delivery', {
          ...args,
          p_provider_message_id: sent.providerMessageId
        })
      )
        result.accepted++
      else result.lostClaims++
    } catch (error) {
      if (error instanceof DeliveryDatabaseError && error.code === '40001') {
        result.lostClaims++
        continue
      }
      if (error instanceof DeliveryDatabaseError && error.code === '22023') {
        await call('stop_outbox_delivery', {
          ...args,
          p_code: 'recipient_unavailable',
          p_suppressed: true
        })
        result.suppressed++
        continue
      }
      await fail(
        error instanceof z.ZodError ? 'invalid_delivery_context' : 'notification_delivery_failed',
        !(error instanceof z.ZodError)
      )
    }
  }
  return result
}
