import { ApiError } from '@/lib/http/api-error'
import type { UserRole } from '@/lib/domain/types'

type Assurance = { role: UserRole; assuranceLevel: 'aal1' | 'aal2' }
/** Receives only the database-verified, currently active session context. */
export function assertAdminAssurance(session: Assurance) {
  if (session.role === 'admin' && session.assuranceLevel !== 'aal2')
    throw new ApiError('mfa_required')
}
/** Financial administration and professional payment-account operations need MFA. */
export function assertFinancialAssurance(session: Assurance) {
  if (session.role !== 'customer' && session.assuranceLevel !== 'aal2')
    throw new ApiError('mfa_required')
}
