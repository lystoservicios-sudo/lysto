import 'server-only'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { assertPublicSupabaseEnv } from '@/lib/supabase/env'
import { ApiError } from '@/lib/http/api-error'
import type { Database } from '@/lib/supabase/database.types'

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/)
const registerCredentials = z.object({
  token: tokenSchema,
  password: z.string().min(1).max(128),
  existingPassword: z.boolean().optional()
}).strict()
const loginCredentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128)
}).strict()

function registrationAdmin() {
  const { url } = assertPublicSupabaseEnv()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new ApiError('service_unavailable')
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  })
}

export async function invitationAuthentication(input: unknown, register: boolean) {
  const client = await createServerSupabaseClient()
  if (!register) {
    const data = loginCredentials.parse(input)
    const result = await client.auth.signInWithPassword(data)
    if (result.error || !result.data.user) throw new ApiError('unauthorized')
    return { message: 'Sesión iniciada. Continuá tu registro profesional.' }
  }

  const data = registerCredentials.parse(input)
  if (!data.existingPassword && (data.password.length < 8 || data.password.length > 12))
    throw new ApiError('invalid_input')
  const admin = registrationAdmin()
  const tokenHash = createHash('sha256').update(data.token).digest('hex')
  const invitation = await admin.from('professional_invitations')
    .select('id,email,status,expires_at,consumed_at,bound_auth_user_id,flow_version')
    .eq('token_hash', tokenHash).maybeSingle()
  if (invitation.error) throw new ApiError('service_unavailable')
  const record = invitation.data
  if (!record || !['queued', 'sent'].includes(record.status) || record.consumed_at
    || record.bound_auth_user_id || new Date(record.expires_at).getTime() <= Date.now())
    throw new ApiError('not_found')
  if (data.existingPassword && record.flow_version !== 1) throw new ApiError('invalid_input')

  // A bearer invitation proves control of the invited mailbox. This server-only
  // operation creates a confirmed identity; it does not weaken customer signup.
  let interruptedAttempt = false
  if (!data.existingPassword) {
    const created = await admin.auth.admin.createUser({
      email: record.email,
      password: data.password,
      email_confirm: true,
      app_metadata: { app_role: 'professional', signup_source: 'professional_invitation' }
    })
    interruptedAttempt = ['email_exists', 'user_already_exists'].includes(created.error?.code ?? '')
    if ((created.error || !created.data.user) && !interruptedAttempt) {
      if (created.error?.code === 'weak_password') throw new ApiError('invalid_input')
      throw new ApiError('service_unavailable')
    }
  }
  const signedIn = await client.auth.signInWithPassword({ email: record.email, password: data.password })
  if (signedIn.error || !signedIn.data.session)
    throw new ApiError(data.existingPassword ? 'unauthorized' : interruptedAttempt ? 'conflict' : 'session_unavailable')
  const resumedNew = signedIn.data.user?.app_metadata?.app_role === 'professional' &&
    signedIn.data.user?.app_metadata?.signup_source === 'professional_invitation'
  const resumedLegacy = record.flow_version === 1 &&
    signedIn.data.user?.user_metadata?.professional_onboarding === true
  if ((interruptedAttempt || data.existingPassword) && !resumedNew && !resumedLegacy) {
    await client.auth.signOut({ scope: 'local' })
    throw new ApiError('conflict')
  }
  const accepted = await client.rpc('accept_professional_invitation', { p_token: data.token })
  if (accepted.error) {
    await client.auth.signOut({ scope: 'local' })
    if (accepted.error.code === 'P0002') throw new ApiError('not_found')
    if (accepted.error.code === '40001') throw new ApiError('conflict')
    throw new ApiError('service_unavailable')
  }
  const result = z.object({ professionalId: z.string().uuid(), status: z.literal('form_started') })
    .strict().safeParse(accepted.data)
  if (!result.success) {
    await client.auth.signOut({ scope: 'local' })
    throw new ApiError('service_unavailable')
  }
  const refreshed = await client.auth.refreshSession()
  if (refreshed.error || !refreshed.data.session) {
    await client.auth.signOut({ scope: 'local' })
    throw new ApiError('session_unavailable')
  }
  return { professionalId: result.data.professionalId }
}
