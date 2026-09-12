'use server'

import { redirect } from 'next/navigation'

import { authenticateLogin, type LoginGateway, type LoginProfile } from '@/lib/auth/login'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { assertAccountMutationOrigin, bootstrapVerifiedCustomer } from '@/lib/auth/account-server'
import { readTrustedRole } from '@/lib/auth/session-routing'
import { enforceRateLimit, serverActionSubject } from '@/lib/security/rate-limit'

type ProfileSelection = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'role'>
type ProfessionalSelection = Pick<
  Database['public']['Tables']['professional_profiles']['Row'],
  'status'
>

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

      async findProfile(userId): Promise<LoginProfile | null> {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id,role')
          .eq('auth_user_id', userId)
          .maybeSingle<ProfileSelection>()

        if (profileError || !profile || profile.role !== trustedRole) return null
        if (profile.role !== 'professional') return { role: profile.role }

        const { data: professional, error: professionalError } = await supabase
          .from('professional_profiles')
          .select('status')
          .eq('profile_id', profile.id)
          .maybeSingle<ProfessionalSelection>()

        if (professionalError || !professional) return null
        return {
          role: profile.role,
          professionalApproved: professional.status === 'approved'
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
