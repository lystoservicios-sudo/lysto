import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const runOutboxBatch = vi.hoisted(() => vi.fn())
const logEvent = vi.hoisted(() => vi.fn())
vi.mock('@/lib/notifications/worker', () => ({ runOutboxBatch }))
vi.mock('@/lib/observability/logger', () => ({ logEvent }))

beforeEach(() => {
  vi.resetModules()
  runOutboxBatch.mockReset()
  logEvent.mockReset()
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lystohogar.com')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
  vi.stubEnv('NOTIFICATIONS_EMAIL_FROM', 'Lysto <notificaciones@lystohogar.com>')
  vi.stubEnv('NOTIFICATIONS_EMAIL_ENABLED', 'true')
  vi.stubEnv('RESEND_API_KEY', 'test-resend-key')
})
afterEach(() => vi.unstubAllEnvs())

it('logs which required configuration is missing without logging secret values', async () => {
  vi.stubEnv('NOTIFICATIONS_EMAIL_ENABLED', 'false')
  const { dispatchProfessionalInvitation } = await import('@/lib/notifications/server')
  await expect(dispatchProfessionalInvitation('96000000-0000-4000-8000-000000000001')).resolves.toEqual({
    accepted: false, reason: 'email_not_configured'
  })
  expect(logEvent).toHaveBeenCalledWith('warn', 'professional_invitation.delivery_not_configured', {
    emailEnabled: false,
    hasResendKey: true,
    hasFrom: true,
    hasDatabaseKey: true
  })
})

it('logs the database error code when invitation claiming fails', async () => {
  runOutboxBatch.mockRejectedValue(Object.assign(new Error('sensitive details'), { code: 'PGRST202' }))
  const { dispatchProfessionalInvitation } = await import('@/lib/notifications/server')
  await expect(dispatchProfessionalInvitation('96000000-0000-4000-8000-000000000001')).resolves.toEqual({
    accepted: false, reason: 'delivery_failed'
  })
  expect(logEvent).toHaveBeenCalledWith('error', 'professional_invitation.delivery_exception', {
    code: 'PGRST202'
  })
  expect(JSON.stringify(logEvent.mock.calls)).not.toContain('sensitive details')
})

it('logs claim and acceptance counts when the worker does not send', async () => {
  runOutboxBatch.mockResolvedValue({ claimed: 0, accepted: 0, failed: 0, suppressed: 0, lostClaims: 0 })
  const { dispatchProfessionalInvitation } = await import('@/lib/notifications/server')
  await expect(dispatchProfessionalInvitation('96000000-0000-4000-8000-000000000001')).resolves.toEqual({
    accepted: false, reason: 'delivery_failed'
  })
  expect(logEvent).toHaveBeenCalledWith('warn', 'professional_invitation.delivery_result', {
    claimed: 0, accepted: 0, failed: 0, suppressed: 0, lostClaims: 0
  })
})
