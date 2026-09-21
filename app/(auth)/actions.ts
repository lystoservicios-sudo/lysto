'use server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { textValue } from '@/lib/auth/customer-access'
import { authOrigin, GENERIC_RECOVERY_MESSAGE } from '@/lib/auth/account-lifecycle'
import { assertAccountMutationOrigin } from '@/lib/auth/account-server'
import { enforceRateLimit, serverActionSubject } from '@/lib/security/rate-limit'
import { registerAction as registerCustomerAction } from './registro/actions'
import { recoverAction } from './recuperar/actions'

export type AuthActionState = { status: 'idle' | 'error' | 'success'; email: string; message: string }
function errorState(message: string, email = ''): AuthActionState { return { status: 'error', email, message } }

export async function registerAction(state: AuthActionState, data: FormData): Promise<AuthActionState> {
  // Compatibility entry point uses the same acceptance, origin and rate-limit boundary.
  if (!data.has('repeatPassword')) data.set('repeatPassword', textValue(data, 'confirmPassword'))
  return { ...await registerCustomerAction(state, data), email: textValue(data, 'email').trim().toLowerCase() }
}

export async function googleAuthAction(_state: AuthActionState, data: FormData): Promise<AuthActionState> {
  void _state
  void data
  return errorState('Google no está disponible en este momento. Podés continuar con tu email.')
}

export async function recoverPasswordAction(state: AuthActionState, data: FormData): Promise<AuthActionState> {
  return { ...await recoverAction(state, data), email: textValue(data, 'email').trim().toLowerCase() }
}

export async function resendConfirmationAction(_state: AuthActionState, data: FormData): Promise<AuthActionState> {
  const email = textValue(data, 'email').trim().toLowerCase()
  if (!z.string().email().max(254).safeParse(email).success) return errorState('Ingresá un email válido.', email)
  try {
    await assertAccountMutationOrigin()
    await enforceRateLimit('recovery', await serverActionSubject(email))
    const client = await createServerSupabaseClient()
    // Identical response for existing, absent and provider-limited email addresses.
    await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${authOrigin(process.env.NEXT_PUBLIC_APP_URL)}/auth/confirm` } })
  } catch { return { status: 'success', email, message: GENERIC_RECOVERY_MESSAGE } }
  return { status: 'success', email, message: GENERIC_RECOVERY_MESSAGE }
}
