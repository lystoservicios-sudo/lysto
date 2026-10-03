'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { authenticateLogin, type LoginGateway, type LoginProfile } from '@/lib/auth/login'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { assertAccountMutationOrigin, bootstrapVerifiedCustomer } from '@/lib/auth/account-server'
import { professionalInvitationToken, readTrustedRole } from '@/lib/auth/session-routing'
import { enforceRateLimit, serverActionSubject } from '@/lib/security/rate-limit'

const loginContextSchema = z.object({
  role: z.enum(['customer', 'professional', 'admin']),
  professional_status: z.string().nullable(),
  professional_eligible: z.boolean(),
  aal: z.enum(['aal1', 'aal2'])
})

export type LoginActionState = {
  status: 'idle' | 'error'
  email: string
  message: string
}

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const credentials = {
    email: textValue(formData, 'email'),
    password: textValue(formData, 'password')
  }
  const next = textValue(formData, 'next')
  const invitationToken = professionalInvitationToken(next)

  let destination: string | null = null

  try {
    await assertAccountMutationOrigin()
    await enforceRateLimit('auth', await serverActionSubject(credentials.email))
    const supabase = await createServerSupabaseClient()
    let trustedRole: string | null = null
    const gateway: LoginGateway = {
      async signIn({ email, password }) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error || !data.user) {
          return {
            ok: false,
            reason: error?.code === 'invalid_credentials' ? 'invalid_credentials' : 'unexpected'
          }
        }

        trustedRole = readTrustedRole(data.user.app_metadata)
        if (!trustedRole) {
          await supabase.auth.signOut({ scope: 'local' })
          return { ok: false, reason: 'unexpected' }
        }
        if (invitationToken && trustedRole !== 'professional') {
          await supabase.auth.signOut({ scope: 'local' })
          return { ok: false, reason: 'invalid_professional_invitation' }
        }
        if (trustedRole === 'professional') {
          const accepted = await supabase.rpc('accept_professional_invitation', {
            p_token: invitationToken
          })
          if (accepted.error) {
            await supabase.auth.signOut({ scope: 'local' })
            return {
              ok: false,
              reason: accepted.error.code === 'P0002' ? 'invalid_professional_invitation' : 'unexpected'
            }
          }
          if (accepted.data) {
            const refreshed = await supabase.auth.refreshSession()
            if (refreshed.error || !refreshed.data.session) {
              await supabase.auth.signOut({ scope: 'local' })
              return { ok: false, reason: 'unexpected' }
            }
          }
        }
        const prepared = await bootstrapVerifiedCustomer(supabase, data.user)
        return { ok: true, userId: data.user.id, accountIncomplete: prepared === 'incomplete' }
      },

      async findProfile(): Promise<LoginProfile | null> {
        const { data, error } = await supabase.rpc('get_session_context')
        const context = loginContextSchema.safeParse(data)
        if (error || !context.success || context.data.role !== trustedRole) return null
        const setup = context.data.role === 'professional'
          ? await supabase.rpc('professional_password_change_ready')
          : null
        const setupComplete = setup?.data === true
        return {
          role: context.data.role,
          professionalApproved:
            context.data.role !== 'professional' ||
            (context.data.professional_status === 'approved' && context.data.professional_eligible) ||
            (['form_submitted', 'under_review'].includes(context.data.professional_status ?? '') && setupComplete),
          professionalOnboarding: context.data.role === 'professional' &&
            (context.data.professional_status === 'rejected' ||
              (['form_started', 'form_submitted', 'under_review'].includes(
                context.data.professional_status ?? '') && !setupComplete)),
          assuranceLevel: context.data.aal
        }
      },

      async signOut() {
        await supabase.auth.signOut()
      }
    }

    const result = await authenticateLogin(
      { ...credentials, next },
      gateway
    )
    if (!result.ok) {
      return {
        status: 'error',
        email: result.email,
        message: result.message
      }
    }

    destination = result.redirectTo
  } catch {
    return {
      status: 'error',
      email: credentials.email.trim().toLowerCase(),
      message: 'No pudimos conectarnos con Lysto. Intentá nuevamente.'
    }
  }

  redirect(destination)
}
