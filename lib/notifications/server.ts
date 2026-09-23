import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { notificationOrigin } from './delivery-template'
import { sendTransactionalEmail } from './provider'
import { runOutboxBatch } from './worker'

export async function dispatchNotifications(batchSize: number, invitationId?: string) {
  const appUrl = notificationOrigin(process.env.NEXT_PUBLIC_APP_URL ?? '')
  const enabled = process.env.NOTIFICATIONS_EMAIL_ENABLED === 'true'
  const from = enabled
    ? z
        .string()
        .regex(/^(?:[^<>\r\n]+ <)?[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>?$/)
        .parse(process.env.NOTIFICATIONS_EMAIL_FROM)
    : 'Lysto <notificaciones@example.invalid>'
  const apiKey = enabled ? z.string().min(1).parse(process.env.RESEND_API_KEY) : null
  if (enabled && process.env.APP_ENV === 'test') throw new Error('real_email_disabled_in_tests')
  const deadline = AbortSignal.timeout(45000)
  const client = createClient(
    z.string().url().parse(process.env.NEXT_PUBLIC_SUPABASE_URL),
    z.string().min(1).parse(process.env.SUPABASE_SERVICE_ROLE_KEY),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            redirect: 'error',
            signal: AbortSignal.any([
              deadline,
              AbortSignal.timeout(8000),
              ...(init?.signal ? [init.signal] : [])
            ])
          })
      }
    }
  )
  return runOutboxBatch(client, {
    appUrl,
    from,
    batchSize,
    invitationId,
    sendEmail: apiKey
      ? async (snapshot) => {
          const { from, to, subject, text, html } = snapshot.content
          return sendTransactionalEmail(
            { from, to, subject, text, html },
            {
              apiKey,
              idempotencyKey: snapshot.idempotencyKey,
              firstAttemptAt: snapshot.firstAttemptAt
            }
          )
        }
      : undefined
  })
}

export async function dispatchProfessionalInvitation(invitationId: string): Promise<{
  accepted: boolean
  reason: 'email_not_configured' | 'delivery_failed' | null
}> {
  if (
    process.env.NOTIFICATIONS_EMAIL_ENABLED !== 'true' ||
    !process.env.RESEND_API_KEY ||
    !process.env.NOTIFICATIONS_EMAIL_FROM ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return { accepted: false, reason: 'email_not_configured' }
  try {
    const result = await dispatchNotifications(1, invitationId)
    return result.accepted === 1
      ? { accepted: true, reason: null }
      : { accepted: false, reason: 'delivery_failed' }
  } catch {
    return { accepted: false, reason: 'delivery_failed' }
  }
}
