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
  professionalOnboarding?: boolean
  assuranceLevel: 'aal1' | 'aal2'
}

type SignInResult =
  | { ok: true; userId: string; accountIncomplete?: boolean }
  | { ok: false; reason: 'invalid_credentials' | 'invalid_professional_invitation' | 'unexpected' }

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
        : signIn.reason === 'invalid_professional_invitation'
          ? 'La invitación venció o ya no es válida. Pedí a administración que te envíe otra.'
          : 'No pudimos iniciar sesión. Intentá nuevamente.'
    }
  }

  if (signIn.accountIncomplete) return { ok: true, redirectTo: '/completar-cuenta' }

  const profile = await gateway.findProfile(signIn.userId)
  if (!profile) {
    await gateway.signOut()
    return {
      ok: false,
      email,
      message: 'Tu cuenta todavía no tiene un perfil habilitado en Lysto.'
    }
  }

  if (profile.role === 'professional' && !profile.professionalApproved && !profile.professionalOnboarding) {
    await gateway.signOut()
    return {
      ok: false,
      email,
      message: 'Tu perfil técnico todavía no está aprobado por Lysto.'
    }
  }

  const requested = safeLocalRedirectPath(input.next, profile.role)
  const destination = profile.role === 'professional'
    ? profile.professionalOnboarding
      ? '/pro/onboarding'
      : requested.startsWith('/pro/onboarding') ? '/pro/dashboard' : requested
    : requested
  if (profile.role !== 'customer' && profile.assuranceLevel !== 'aal2') {
    return { ok: true, redirectTo: `/seguridad?next=${encodeURIComponent(destination)}` }
  }

  return { ok: true, redirectTo: destination }
}
