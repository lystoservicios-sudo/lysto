import { expect, test } from '../_lib/test.ts'
import { canAccessRoute, normalizePhoneForArgentina, redirectAfterLogin, validateCustomerSignup, validateProfessionalInvite } from '../../lib/auth/onboarding-access.ts'

test('customer signup validates required identity and terms', () => {
  const result = validateCustomerSignup({ firstName: 'Ana', lastName: 'López', email: 'ana@correo.com', phone: '11 5555-4444', password: 'clave1234', acceptedTerms: true })
  expect(result.ok).toBe(true)
})

test('customer signup rejects weak password and missing terms', () => {
  const result = validateCustomerSignup({ firstName: 'Ana', lastName: 'López', email: 'ana@correo.com', phone: '11 5555-4444', password: '123', acceptedTerms: false })
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.errors).toContain('password_min_8')
})

test('professional invite rejects expired token', () => {
  const result = validateProfessionalInvite({ token: 'abcdefghijklmnopqrstuvwxyz', status: 'sent', expiresAt: '2026-01-01T00:00:00.000Z', email: 'tecnico@lysto.com' }, '2026-08-19T00:00:00.000Z')
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe('invite_expired')
})

test('route access blocks professional before approval', () => {
  const allowed = canAccessRoute({ id: 'p1', role: 'professional', professionalStatus: 'under_review', hasProfessionalProfile: true }, '/pro')
  expect(allowed).toBe(false)
})

test('redirect after login sends approved professional to pro dashboard', () => {
  expect(redirectAfterLogin({ id: 'p1', role: 'professional', professionalStatus: 'approved' })).toBe('/pro/dashboard')
})

test('normalizes argentina phone to international format', () => {
  expect(normalizePhoneForArgentina('11 5555 4444')).toBe('+541155554444')
})
