import { z } from 'zod'

const header = z
  .string()
  .min(1)
  .max(500)
  .refine((value) => !/[\r\n]/.test(value))
export const emailSnapshotSchema = z
  .object({
    from: header,
    to: z.string().email().max(320),
    subject: header,
    text: z.string().min(1).max(16000),
    html: z.string().min(1).max(32000)
  })
  .strict()
export type EmailSnapshot = z.infer<typeof emailSnapshotSchema>
export type EmailResult =
  | { accepted: true; providerMessageId: string }
  | { accepted: false; retryable: boolean; code: string }

/** Reserve a margin within Resend's 24-hour deduplication retention. */
export const EMAIL_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000

export async function sendTransactionalEmail(
  message: EmailSnapshot,
  options: {
    apiKey: string
    idempotencyKey: string
    firstAttemptAt: string
    now?: Date
    fetcher?: typeof fetch
  }
): Promise<EmailResult> {
  const first = Date.parse(options.firstAttemptAt)
  const age = (options.now ?? new Date()).getTime() - first
  if (!Number.isFinite(age) || age < 0 || age >= EMAIL_RETRY_WINDOW_MS)
    return { accepted: false, retryable: false, code: 'provider_window_requires_review' }
  if (
    !emailSnapshotSchema.safeParse(message).success ||
    !/^[a-zA-Z0-9_-]{1,256}$/.test(options.idempotencyKey)
  )
    return { accepted: false, retryable: false, code: 'invalid_email_snapshot' }
  try {
    const response = await (options.fetcher ?? fetch)('https://api.resend.com/emails', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': options.idempotencyKey
      },
      body: JSON.stringify({ ...message, to: [message.to] })
    })
    if (response.status === 409) {
      const value = await response.json().catch(() => null)
      const concurrent = value?.name === 'concurrent_idempotent_requests'
      return {
        accepted: false,
        retryable: concurrent,
        code: concurrent ? 'provider_concurrent_request' : 'provider_idempotency_conflict'
      }
    }
    if (!response.ok)
      return {
        accepted: false,
        retryable: response.status === 429 || response.status >= 500,
        code: `provider_http_${response.status}`
      }
    const result = await response.json()
    if (typeof result?.id === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(result.id))
      return { accepted: true, providerMessageId: result.id }
  } catch {
    /* A connection failure does not prove that the provider rejected the email. */
  }
  return { accepted: false, retryable: true, code: 'provider_response_uncertain' }
}
