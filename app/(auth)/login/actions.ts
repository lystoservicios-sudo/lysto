'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { safeCustomerNext, textValue } from '@/lib/auth/customer-access'
import { resolvedCustomerDestination } from '@/lib/auth/customer-session'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type LoginActionState = { status: 'idle' | 'error'; email: string; message: string }

export async function loginAction(_previousState: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const email = textValue(formData, 'email').trim().toLowerCase()
  const password = textValue(formData, 'password')
  if (!z.string().email().safeParse(email).success || !password) return { status: 'error', email, message: 'Ingresá tu email y contraseña.' }
  let destination: string
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) return { status: 'error', email, message: error?.code === 'email_not_confirmed' ? 'Confirmá tu email antes de ingresar. Revisá también la carpeta de spam.' : error?.code === 'invalid_credentials' ? 'El email o la contraseña no son correctos.' : 'No pudimos iniciar sesión. Intentá nuevamente.' }
    destination = await resolvedCustomerDestination(safeCustomerNext(textValue(formData, 'next')), supabase)
  } catch {
    return { status: 'error', email, message: 'No pudimos conectarnos con Lysto. Intentá nuevamente.' }
  }
  redirect(destination)
}
