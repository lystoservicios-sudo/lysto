import { test, expect } from '../_lib/test.ts'
import { decideProfessionalAssignment } from '../../lib/admin/assignment.ts'
import { decideProfessionalApproval } from '../../lib/admin/professional-approval.ts'
import { validatePricingRuleUpdate } from '../../lib/admin/pricing-admin.ts'
import type { ProfessionalCandidate } from '../../lib/matching/score-professionals.ts'
import type { ProfessionalOnboardingInput } from '../../lib/professional/onboarding.ts'

const candidates: ProfessionalCandidate[] = [
  { id: 'bad', name: 'Suspendido', status: 'suspended', serviceSlugs: ['aire_acondicionado'], zones: ['caba'], available: true, hasLicense: true, toolsScore: 10, ratingAvg: 5, jobsCompleted: 100, activeJobs: 0, acceptanceRate: 1, distanceKm: 1, internalScore: 100 },
  { id: 'ok', name: 'Aprobado', status: 'approved', serviceSlugs: ['aire_acondicionado'], zones: ['caba'], available: true, hasLicense: true, toolsScore: 8, ratingAvg: 4.7, jobsCompleted: 24, activeJobs: 0, acceptanceRate: 0.9, distanceKm: 4, internalScore: 82 }
]

const onboarding = {
  firstName: 'Martin',
  lastName: 'Gomez',
  email: 'martin@lysto.test',
  phone: '1122334455',
  dni: '30111222',
  cuil: '20301112223',
  birthdate: '1990-01-10',
  yearsExperience: 6,
  licenseNumber: 'MAT-123',
  hasMobility: true,
  zones: ['caba'],
  tools: ['manifold', 'multimetro', 'herramientas_manual', 'elementos_seguridad'],
  availabilitySlots: [{ weekday: 1, startTime: '08:00', endTime: '18:00' }]
} satisfies ProfessionalOnboardingInput

test('admin assignment chooses only eligible professionals', () => {
  const result = decideProfessionalAssignment({ requestId: 'REQ-1', requestStatus: 'pending_assignment', paid: true, candidates, mode: 'auto_suggested' })
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.assignedProfessionalId).toBe('ok')
})

test('admin assignment permite ofertar presupuesto aceptado antes del pago', () => {
  const result = decideProfessionalAssignment({ requestId: 'REQ-1', requestStatus: 'pending_assignment', paid: false, candidates, mode: 'auto_suggested' })
  expect(result.ok).toBe(true)
})

test('professional approval requires documents and admin', () => {
  const result = decideProfessionalApproval({ professionalId: 'PRO-1', currentStatus: 'under_review', onboarding, documents: [{ type: 'dni', status: 'approved' }, { type: 'license', status: 'approved' }], adminProfileId: 'ADM-1', decision: 'approve' })
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.nextStatus).toBe('approved')
})

test('professional approval blocks missing license document', () => {
  const result = decideProfessionalApproval({ professionalId: 'PRO-1', currentStatus: 'under_review', onboarding, documents: [{ type: 'dni', status: 'approved' }], adminProfileId: 'ADM-1', decision: 'approve' })
  expect(result.ok).toBe(false)
})

test('pricing update protects negative prices and normalizes values', () => {
  const result = validatePricingRuleUpdate({ categorySlug: 'aire_acondicionado', issue: 'no_enfria', zoneSlug: 'caba', basePrice: 35000.4, issueAdjustment: 4999.7, priorityMultiplier: 1.2479, platformFeeRate: 0.1812, adminProfileId: 'ADM-1' })
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.normalized.basePrice).toBe(35000)
    expect(result.normalized.priorityMultiplier).toBe(1.248)
    expect(result.affectedFutureRequestsOnly).toBe(true)
  }
})
