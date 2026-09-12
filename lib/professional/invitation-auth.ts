import 'server-only'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ApiError } from '@/lib/http/api-error'
import { authOrigin, GENERIC_REGISTRATION_MESSAGE } from '@/lib/auth/account-lifecycle'

const credentials = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(128)
  })
  .strict()
export async function invitationAuthentication(input: unknown, register: boolean) {
  const data = (
    register
      ? credentials
          .extend({ password: z.string().min(12).max(128), repeatPassword: z.string() })
          .refine((value) => value.password === value.repeatPassword)
      : credentials.extend({ token: credentials.shape.token.optional() })
  ).parse(input)
  const client = await createServerSupabaseClient()
  if (register) {
    const matches = await client.rpc('professional_invitation_matches', {
      p_token: data.token!,
      p_email: data.email
    })
    if (matches.error) throw new ApiError('service_unavailable')
    if (matches.data !== true) throw new ApiError('not_found')
    const result = await client.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${authOrigin(process.env.NEXT_PUBLIC_APP_URL)}/auth/confirm`,
        // Navigation hint only. SQL verifies the invitation before granting a role.
        data: { professional_onboarding: true }
      }
    })
    if (
      result.error &&
      !['user_already_exists', 'email_exists', 'over_email_send_rate_limit'].includes(
        result.error.code ?? ''
      )
    )
      throw new ApiError('service_unavailable')
    return {
      message:
        GENERIC_REGISTRATION_MESSAGE +
        ' Después de confirmar el correo, volvé al enlace de invitación.'
    }
  }
  const result = await client.auth.signInWithPassword({
    email: data.email,
    password: data.password
  })
  if (result.error || !result.data.user) throw new ApiError('unauthorized')
  return { message: 'Sesión iniciada. Ya podés aceptar tu invitación.' }
}
