export type ProfessionalInvitationInput = {
  email: string
  phone?: string
  specialtySlug: string
  expiresInDays?: number
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateProfessionalInvitation(input: ProfessionalInvitationInput): string[] {
  const errors: string[] = []
  if (!emailRegex.test(input.email)) errors.push('Email inválido')
  if (!input.specialtySlug.trim()) errors.push('Especialidad obligatoria')
  if (input.expiresInDays !== undefined && (input.expiresInDays < 1 || input.expiresInDays > 60)) errors.push('La invitación debe vencer entre 1 y 60 días')
  return errors
}

export function buildInvitationPublicPath(token: string): string {
  if (!token || token.length < 12) throw new Error('Invalid invitation token')
  return `/pro/onboarding/${token}`
}
