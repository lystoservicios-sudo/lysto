import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { notificationOrigin } from './delivery-template'
import { sendTransactionalEmail } from './provider'
import { runOutboxBatch } from './worker'
import { logEvent } from '@/lib/observability/logger'

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
  const configuration = {
    emailEnabled: process.env.NOTIFICATIONS_EMAIL_ENABLED === 'true',
    hasResendKey: Boolean(process.env.RESEND_API_KEY),
    hasFrom: Boolean(process.env.NOTIFICATIONS_EMAIL_FROM),
    hasDatabaseKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  }
  if (Object.values(configuration).some((ready) => !ready)) {
    logEvent('warn', 'professional_invitation.delivery_not_configured', configuration)
    return { accepted: false, reason: 'email_not_configured' }
  }
  try {
    const result = await dispatchNotifications(1, invitationId)
    logEvent(result.accepted === 1 ? 'info' : 'warn', 'professional_invitation.delivery_result', {
      claimed: result.claimed,
      accepted: result.accepted,
      failed: result.failed,
      suppressed: result.suppressed,
      lostClaims: result.lostClaims
    })
    return result.accepted === 1
      ? { accepted: true, reason: null }
      : { accepted: false, reason: 'delivery_failed' }
  } catch (error) {
    const rawCode = error && typeof error === 'object' && 'code' in error ? error.code : null
    const code = typeof rawCode === 'string' && /^[A-Za-z0-9_]{1,32}$/.test(rawCode)
      ? rawCode
      : 'unexpected'
    logEvent('error', 'professional_invitation.delivery_exception', { code })
    return { accepted: false, reason: 'delivery_failed' }
  }
}
