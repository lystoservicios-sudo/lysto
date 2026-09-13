'use server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { assertPublicSupabaseEnv } from '@/lib/supabase/env'
import { safeCustomerNext, textValue } from '@/lib/auth/customer-access'
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
  let destination: string
  try {
    await assertAccountMutationOrigin()
    await enforceRateLimit('auth', await serverActionSubject('google'))
    const env = assertPublicSupabaseEnv()
    const settings = await fetch(`${env.url}/auth/v1/settings`, { headers: { apikey: env.anonKey }, cache: 'no-store', signal: AbortSignal.timeout(7000) })
    const providers = settings.ok ? await settings.json() as { external?: { google?: boolean } } : null
    if (!providers?.external?.google) return errorState('Google no está disponible en este momento. Podés continuar con tu email.')
    const supabase = await createServerSupabaseClient()
    const { data: result, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${authOrigin(process.env.NEXT_PUBLIC_APP_URL)}/auth/callback?next=${encodeURIComponent(safeCustomerNext(textValue(data, 'next')))}`, skipBrowserRedirect: true } })
    if (error || !result.url) return errorState('No pudimos continuar con Google. Intentá con tu email o volvé a probar.')
    destination = result.url
  } catch { return errorState('Google no está disponible en este momento. Podés continuar con tu email.') }
  redirect(destination)
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
