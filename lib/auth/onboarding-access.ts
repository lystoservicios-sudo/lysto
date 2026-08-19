import type { ProfessionalStatus, UserRole } from '../domain/types.ts'

export type AuthRoute =
  | '/app'
  | '/pro'
  | '/admin'
  | '/login'
  | '/registro'
  | '/pro/onboarding'

export type SignupInput = {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  password?: string
  acceptedTerms?: boolean
}

export type ProfessionalInvite = {
  token: string
  status: 'sent' | 'opened' | 'completed' | 'expired' | 'cancelled'
  expiresAt: string
  email: string
}

export type SessionProfile = {
  id: string
  role: UserRole
  professionalStatus?: ProfessionalStatus
  hasCustomerProfile?: boolean
  hasProfessionalProfile?: boolean
  hasAdminProfile?: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateCustomerSignup(input: SignupInput): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = []
  if (!input.firstName?.trim()) errors.push('first_name_required')
  if (!input.lastName?.trim()) errors.push('last_name_required')
  if (!input.email?.trim() || !EMAIL_RE.test(input.email)) errors.push('valid_email_required')
  if (!input.phone?.trim() || input.phone.replace(/\D/g, '').length < 8) errors.push('valid_phone_required')
  if (!input.password || input.password.length < 8) errors.push('password_min_8')
  if (!input.acceptedTerms) errors.push('terms_required')
  return errors.length ? { ok: false, errors } : { ok: true }
}

export function validateProfessionalInvite(invite: ProfessionalInvite, nowIso: string): { ok: true; nextStatus: 'opened' | 'completed' } | { ok: false; reason: string } {
  if (!invite.token || invite.token.length < 24) return { ok: false, reason: 'invalid_token' }
  if (invite.status === 'completed') return { ok: false, reason: 'invite_already_completed' }
  if (invite.status === 'cancelled') return { ok: false, reason: 'invite_cancelled' }
  if (invite.status === 'expired') return { ok: false, reason: 'invite_expired' }
  if (new Date(invite.expiresAt).getTime() <= new Date(nowIso).getTime()) return { ok: false, reason: 'invite_expired' }
  return { ok: true, nextStatus: invite.status === 'sent' ? 'opened' : 'opened' }
}

export function canAccessRoute(profile: SessionProfile | null, route: AuthRoute): boolean {
  if (route === '/login' || route === '/registro') return true
  if (route === '/pro/onboarding') return true
  if (!profile) return false
  if (route === '/app') return profile.role === 'customer' && profile.hasCustomerProfile !== false
  if (route === '/pro') return profile.role === 'professional' && profile.hasProfessionalProfile !== false && profile.professionalStatus === 'approved'
  if (route === '/admin') return profile.role === 'admin' && profile.hasAdminProfile !== false
  return false
}

export function redirectAfterLogin(profile: SessionProfile): string {
  if (profile.role === 'admin') return '/admin/dashboard'
  if (profile.role === 'professional') {
    if (profile.professionalStatus === 'approved') return '/pro/dashboard'
    if (profile.professionalStatus === 'under_review' || profile.professionalStatus === 'form_submitted') return '/pro/perfil?estado=revision'
    return '/pro/onboarding'
  }
  return '/app'
}

export function normalizePhoneForArgentina(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('54')) return `+${digits}`
  if (digits.startsWith('0')) return `+54${digits.slice(1)}`
  return `+54${digits}`
}
