'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { assertPublicSupabaseEnv } from '@/lib/supabase/env'
import { passwordSchema, safeCustomerNext, textValue, validateRegistration } from '@/lib/auth/customer-access'
import { resolvedCustomerDestination } from '@/lib/auth/customer-session'

export type AuthActionState = { status: 'idle' | 'error' | 'success'; email: string; message: string }
const unavailable = 'No pudimos conectarnos con Lysto. Intentá nuevamente en unos minutos.'
function appOrigin() {
  const url = new URL(process.env.NEXT_PUBLIC_APP_URL ?? '')
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid_app_url')
  return url.origin
}
function errorState(message: string, email = ''): AuthActionState { return { status: 'error', email, message } }

export async function registerAction(_state: AuthActionState, data: FormData): Promise<AuthActionState> {
  const email = textValue(data, 'email').trim().toLowerCase()
  const parsed = validateRegistration({ email, password: textValue(data, 'password'), confirmPassword: textValue(data, 'confirmPassword'), firstName: textValue(data, 'firstName'), lastName: textValue(data, 'lastName') })
  if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? 'Revisá los datos.', email)
  let destination: string | null = null
  try {
    const supabase = await createServerSupabaseClient()
    const next = safeCustomerNext(textValue(data, 'next'))
    const { data: result, error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { data: { first_name: parsed.data.firstName, last_name: parsed.data.lastName }, emailRedirectTo: `${appOrigin()}/auth/callback?next=${encodeURIComponent(next)}` } })
    if (error) return errorState(error.code === 'over_email_send_rate_limit' ? 'Esperá unos minutos antes de volver a pedir un email.' : 'No pudimos crear tu cuenta. Revisá los datos o intentá iniciar sesión si ya tenés una.', email)
    if (result.session) destination = await resolvedCustomerDestination(next, supabase)
    else return { status: 'success', email, message: 'Revisá tu email para confirmar tu cuenta y continuar. Si ya tenías una cuenta, iniciá sesión. Revisá también la carpeta de spam.' }
  } catch { return errorState(unavailable, email) }
  redirect(destination)
}

export async function googleAuthAction(_state: AuthActionState, data: FormData): Promise<AuthActionState> {
  let destination: string
  try {
    const env = assertPublicSupabaseEnv()
    const settings = await fetch(`${env.url}/auth/v1/settings`, { headers: { apikey: env.anonKey }, cache: 'no-store', signal: AbortSignal.timeout(7000) })
    const providers = settings.ok ? await settings.json() as { external?: { google?: boolean } } : null
    if (!providers?.external?.google) return errorState('Google no está disponible en este momento. Podés continuar con tu email.')
    const supabase = await createServerSupabaseClient()
    const { data: result, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${appOrigin()}/auth/callback?next=${encodeURIComponent(safeCustomerNext(textValue(data, 'next')))}`, skipBrowserRedirect: true } })
    if (error || !result.url) return errorState('No pudimos continuar con Google. Intentá con tu email o volvé a probar.')
    destination = result.url
  } catch { return errorState('Google no está disponible en este momento. Podés continuar con tu email.') }
  redirect(destination)
}

export async function recoverPasswordAction(_state: AuthActionState, data: FormData): Promise<AuthActionState> {
  const email = textValue(data, 'email').trim().toLowerCase()
  if (!z.string().email().safeParse(email).success) return errorState('Ingresá un email válido.', email)
  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${appOrigin()}/auth/callback?flow=recovery` })
    if (error) return errorState('No pudimos enviar el enlace. Esperá unos minutos e intentá nuevamente.', email)
    return { status: 'success', email, message: 'Si existe una cuenta con este email, vas a recibir un enlace para crear una nueva contraseña. Revisá también la carpeta de spam.' }
  } catch { return errorState(unavailable, email) }
}

export async function updatePasswordAction(_state: AuthActionState, data: FormData): Promise<AuthActionState> {
  const password = textValue(data, 'password')
  const parsed = passwordSchema.safeParse(password)
  if (!parsed.success) return errorState(parsed.error.issues[0].message)
  if (password !== textValue(data, 'confirmPassword')) return errorState('Las contraseñas no coinciden.')
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return errorState('El enlace venció. Pedí un nuevo enlace para recuperar tu contraseña.')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return errorState('No pudimos actualizar la contraseña. Elegí una diferente o pedí un nuevo enlace.')
    await supabase.auth.signOut()
  } catch { return errorState(unavailable) }
  redirect('/login?notice=password-updated')
}

export async function resendConfirmationAction(_state: AuthActionState, data: FormData): Promise<AuthActionState> {
  const email = textValue(data, 'email').trim().toLowerCase()
  if (!z.string().email().safeParse(email).success) return errorState('Ingresá un email válido.', email)
  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${appOrigin()}/auth/callback?next=${encodeURIComponent(safeCustomerNext(textValue(data, 'next')))}` } })
    if (error) return errorState('Esperá unos minutos antes de volver a pedir un email.', email)
    return { status: 'success', email, message: 'Si tu cuenta necesita confirmación, vas a recibir un nuevo enlace por email.' }
  } catch { return errorState(unavailable, email) }
}
