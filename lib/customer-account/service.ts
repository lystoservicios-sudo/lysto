import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { passwordSchema } from '@/lib/auth/customer-access'
import { ApiError } from '@/lib/http/api-error'

const uuid = z.string().uuid()
export const customerPreferencesSchema = z.object({
  version: z.number().int().nonnegative(),
  emailMaintenance: z.boolean(), emailSupportUpdates: z.boolean(),
  marketingEmail: z.boolean(), reduceMotion: z.boolean()
}).strict()
export type CustomerPreferences = z.infer<typeof customerPreferencesSchema>
const preferencesResult = z.object({ preferences: customerPreferencesSchema, essentialEmail: z.literal(true) })
const sessionSchema = z.object({
  id: uuid, current: z.boolean(), createdAt: z.string(), lastSeenAt: z.string().nullable(),
  device: z.string().max(120)
})
const privacySchema = z.object({
  request: z.object({ id: uuid, status: z.string(), createdAt: z.string(), supportCaseId: uuid }).nullable(),
  pending: z.object({ jobs: z.number().int().nonnegative(), payments: z.number().int().nonnegative() })
})
// Each dataset is allowlisted again by its private SQL implementation. Never export
// arbitrary auth rows, raw provider observations or generic table dumps.
const exportSchema = z.object({
  schemaVersion: z.literal(1), exportedAt: z.string(), profile: z.record(z.string(), z.unknown()),
  addresses: z.array(z.record(z.string(), z.unknown())), homes: z.array(z.record(z.string(), z.unknown())),
  equipment: z.array(z.record(z.string(), z.unknown())), serviceRequests: z.array(z.record(z.string(), z.unknown())),
  requestAnswers: z.array(z.record(z.string(), z.unknown())), jobs: z.array(z.record(z.string(), z.unknown())),
  payments: z.array(z.record(z.string(), z.unknown())), serviceReports: z.array(z.record(z.string(), z.unknown())),
  warrantyClaims: z.array(z.record(z.string(), z.unknown())), maintenancePlans: z.array(z.record(z.string(), z.unknown())),
  supportCases: z.array(z.record(z.string(), z.unknown())), reviews: z.array(z.record(z.string(), z.unknown())),
  preferences: customerPreferencesSchema, privacyRequests: z.array(z.record(z.string(), z.unknown()))
})

function requireCustomer(session: Session) {
  if (session.role !== 'customer' || !session.customerId) throw new ApiError('forbidden')
}
function rpcError(error: { code?: string }) {
  if (error.code === 'PT409' || error.code === '40001' || error.code === '23505') return new ApiError('conflict')
  if (error.code === '42501') return new ApiError('forbidden')
  if (error.code === 'P0002') return new ApiError('not_found')
  if (error.code === '22023') return new ApiError('invalid_input')
  return new ApiError('service_unavailable')
}
async function rpc(session: Session, name: string, args: Record<string, unknown> = {}) {
  requireCustomer(session)
  const result = await session.client.rpc(name as never, args as never)
  if (result.error) throw rpcError(result.error)
  return result.data
}
export async function readCustomerPreferences(session: Session) {
  return preferencesResult.parse(await rpc(session, 'read_customer_preferences'))
}
export async function updateCustomerPreferences(session: Session, raw: unknown) {
  const p = customerPreferencesSchema.parse(raw)
  return preferencesResult.parse(await rpc(session, 'write_customer_preferences', {
    p_expected_version: p.version, p_email_maintenance: p.emailMaintenance,
    p_email_support_updates: p.emailSupportUpdates, p_marketing_email: p.marketingEmail,
    p_reduce_motion: p.reduceMotion
  }))
}
export async function listCustomerAccountSessions(session: Session) {
  return { sessions: z.array(sessionSchema).parse(await rpc(session, 'list_customer_account_sessions')) }
}
export async function revokeCustomerAccountSessions(session: Session, raw: unknown) {
  const input = z.discriminatedUnion('action', [
    z.object({ action: z.literal('revoke'), sessionId: uuid }).strict(),
    z.object({ action: z.literal('revokeOthers') }).strict()
  ]).parse(raw)
  if (input.action === 'revoke' && input.sessionId === session.sessionId) throw new ApiError('invalid_input')
  return z.object({ revoked: z.number().int().nonnegative() }).parse(await rpc(session, 'revoke_customer_account_sessions', {
    p_session_id: input.action === 'revoke' ? input.sessionId : null,
    p_all_others: input.action === 'revokeOthers'
  }))
}
async function currentUser(session: Session) {
  requireCustomer(session)
  const { data, error } = await session.client.auth.getUser()
  if (error || !data.user || data.user.id !== session.userId || data.user.app_metadata.app_role !== 'customer') throw new ApiError('unauthorized')
  return data.user
}
async function withCurrentPasswordProof<T>(session: Session, password: string, operation: (url: string) => Promise<T>): Promise<T> {
  const user = await currentUser(session)
  if (!user.email) throw new ApiError('forbidden')
  const url = z.string().url().parse(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const publicKey = z.string().min(1).parse(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  // Do not rely on GoTrue's optional current_password enforcement. An isolated
  // sign-in proves the current password even when that server setting is off.
  // This client never persists browser cookies or replaces the caller session.
  const proof = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const verified = await proof.auth.signInWithPassword({ email: user.email, password })
  try {
    if (verified.error || verified.data.user?.id !== session.userId || verified.data.user.app_metadata.app_role !== 'customer' || !verified.data.session) throw new ApiError('unauthorized')
    return await operation(url)
  } finally {
    if (verified.data.session) {
      const revoked = await proof.auth.signOut({ scope: 'local' })
      if (revoked.error) throw new ApiError('service_unavailable')
    }
  }
}
export async function changeCustomerPassword(session: Session, raw: unknown) {
  const input = z.object({ currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema, confirmPassword: passwordSchema
  }).strict().refine(i => i.newPassword === i.confirmPassword && i.newPassword !== i.currentPassword).parse(raw)
  return withCurrentPasswordProof(session, input.currentPassword, async () => {
    const updated = await session.client.auth.updateUser({ password: input.newPassword, current_password: input.currentPassword })
    if (updated.error) throw new ApiError(updated.error.code === 'weak_password' ? 'invalid_input' : 'unauthorized')
    return { changed: true as const }
  })
}
export async function exportCustomerAccount(session: Session) {
  return exportSchema.parse(await rpc(session, 'export_customer_account'))
}
export async function readCustomerPrivacy(session: Session) {
  return privacySchema.parse(await rpc(session, 'read_customer_account_privacy'))
}
export async function requestCustomerAccountDeletion(session: Session, raw: unknown) {
  const input = z.object({ action: z.literal('requestDeletion'), confirmation: z.literal('ELIMINAR'),
    idempotencyKey: uuid, currentPassword: z.string().min(1).max(128)
  }).strict().parse(raw)
  return withCurrentPasswordProof(session, input.currentPassword, async url => {
    const key = z.string().min(1).parse(process.env.SUPABASE_SERVICE_ROLE_KEY)
    const writer = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    const receipt = await writer.rpc('issue_customer_account_reauth', { p_auth_user_id: session.userId, p_session_id: session.sessionId })
    if (receipt.error) throw rpcError(receipt.error)
    const { receiptId } = z.object({ receiptId: uuid }).parse(receipt.data)
    return privacySchema.parse(await rpc(session, 'request_customer_account_deletion', { p_idempotency_key: input.idempotencyKey, p_receipt_id: receiptId }))
  })
}
