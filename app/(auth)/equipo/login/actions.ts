'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { authenticateLogin, type LoginGateway, type LoginProfile } from '@/lib/auth/login'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { assertAccountMutationOrigin, bootstrapVerifiedCustomer } from '@/lib/auth/account-server'
import { readTrustedRole } from '@/lib/auth/session-routing'
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
        const prepared = await bootstrapVerifiedCustomer(supabase, data.user)
        return { ok: true, userId: data.user.id, accountIncomplete: prepared === 'incomplete' }
      },

      async findProfile(): Promise<LoginProfile | null> {
        const { data, error } = await supabase.rpc('get_session_context')
        const context = loginContextSchema.safeParse(data)
        if (error || !context.success || context.data.role !== trustedRole) return null
        return {
          role: context.data.role,
          professionalApproved:
            context.data.role !== 'professional' ||
            (context.data.professional_status === 'approved' && context.data.professional_eligible),
          professionalOnboarding: context.data.role === 'professional' &&
            ['form_started', 'form_submitted', 'under_review', 'rejected'].includes(
              context.data.professional_status ?? ''),
          assuranceLevel: context.data.aal
        }
      },

      async signOut() {
        await supabase.auth.signOut()
      }
    }

    const result = await authenticateLogin(
      { ...credentials, next: textValue(formData, 'next') },
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
