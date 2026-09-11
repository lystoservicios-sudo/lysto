import { z } from 'zod'

import type { UserRole } from '../domain/types'
import { safeLocalRedirectPath } from './session-routing'

const loginCredentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
})

export type LoginProfile = {
  role: UserRole
  professionalApproved?: boolean
}

type SignInResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'invalid_credentials' | 'unexpected' }

export interface LoginGateway {
  signIn(credentials: { email: string; password: string }): Promise<SignInResult>
  findProfile(userId: string): Promise<LoginProfile | null>
  signOut(): Promise<void>
}

export type LoginResult =
  | { ok: true; redirectTo: string }
  | { ok: false; email: string; message: string }

export async function authenticateLogin(
  input: { email: string; password: string; next?: string },
  gateway: LoginGateway
): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase()
  const parsed = loginCredentialsSchema.safeParse({
    email,
    password: input.password
  })

  if (!parsed.success) {
    return { ok: false, email, message: 'Ingresá tu email y contraseña.' }
  }

  const signIn = await gateway.signIn(parsed.data)
  if (!signIn.ok) {
    return {
      ok: false,
      email,
      message: signIn.reason === 'invalid_credentials'
        ? 'El email o la contraseña no son correctos.'
        : 'No pudimos iniciar sesión. Intentá nuevamente.'
    }
  }

  const profile = await gateway.findProfile(signIn.userId)
  if (!profile) {
    await gateway.signOut()
    return {
      ok: false,
      email,
      message: 'Tu cuenta todavía no tiene un perfil habilitado en Lysto.'
    }
  }

  if (profile.role === 'professional' && !profile.professionalApproved) {
    await gateway.signOut()
    return {
      ok: false,
      email,
      message: 'Tu perfil técnico todavía no está aprobado por Lysto.'
    }
  }

  return { ok: true, redirectTo: safeLocalRedirectPath(input.next, profile.role) }
}
