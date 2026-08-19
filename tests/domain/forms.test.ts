import { test, expect } from '../_lib/test.ts'
import { validateCustomerRequestForm, customerFormCompletionPercent } from '../../lib/forms/customer-request-form.ts'
import { validateProfessionalOnboardingForm } from '../../lib/forms/professional-onboarding-form.ts'
import { validateJobCloseoutForm } from '../../lib/forms/job-closeout-form.ts'
import { validateAdminAction } from '../../lib/forms/admin-action-form.ts'
import { requiredAirConditioningTools } from '../../lib/professional/tool-checklist.ts'

const validCustomer = {
  issue: 'no_enfria' as const,
  timeSince: 'days' as const,
  photosCount: 2,
  videosCount: 1,
  address: { street: 'Av. Corrientes', number: '1240', city: 'CABA', province: 'Buenos Aires', propertyType: 'apartment' as const, access: { hasElevator: true } },
  schedule: { dateChoice: 'tomorrow' as const, timeWindow: '10:00 – 12:00' },
  selectedOption: 'priority' as const
}

test('customer request form normalizes valid payload', () => {
  const result = validateCustomerRequestForm(validCustomer)
  expect(result.ok).toBe(true)
  expect(result.normalized?.address.street).toBe('Av. Corrientes')
  expect(result.normalized?.address.access.hasElevator).toBe(true)
})

test('customer request form rejects missing address and schedule', () => {
  const result = validateCustomerRequestForm({ issue: 'no_enfria', timeSince: 'days' })
  expect(result.ok).toBe(false)
  expect(result.errors).toContain('street_required')
  expect(result.errors).toContain('time_window_required')
})

test('customer form completion percent tracks MVP wizard progress', () => {
  expect(customerFormCompletionPercent({ issue: 'no_enfria' })).toBeGreaterThan(0)
  expect(customerFormCompletionPercent(validCustomer)).toBe(100)
})

test('professional onboarding form is ready with required tools and documents', () => {
  const result = validateProfessionalOnboardingForm({
    firstName: 'Martin',
    lastName: 'Gomez',
    email: 'martin@example.com',
    phone: '+54911',
    dni: '30111222',
    cuil: '20-30111222-9',
    birthdate: '1988-01-01',
    yearsExperience: 8,
    licenseNumber: 'MAT-123',
    licenseEntity: 'Registro',
    hasPhoto: true,
    hasDniDocument: true,
    hasCuilDocument: true,
    hasLicenseDocument: true,
    hasMobility: true,
    zones: ['caba'],
    availabilitySlots: [{ weekday: 1, startTime: '08:00', endTime: '18:00' }],
    tools: [...requiredAirConditioningTools],
    paymentAccountConnected: true
  })
  expect(result.ok).toBe(true)
  expect(result.readyForApproval).toBe(true)
  expect(result.score).toBe(100)
})

test('professional onboarding blocks incomplete documentation', () => {
  const result = validateProfessionalOnboardingForm({ firstName: 'Martin', email: 'bad-email', tools: [] })
  expect(result.ok).toBe(false)
  expect(result.missing).toContain('license_document')
  expect(result.missing).toContain('required_tools')
})

test('job closeout requires equipment report and after photo', () => {
  const result = validateJobCloseoutForm({ jobId: 'job-1', equipmentId: 'eq-1', realDiagnosis: 'Carga de gas baja', workDone: 'Se reviso presión y filtros', finalState: 'resolved', afterPhotosCount: 1, warrantyDays: 30 })
  expect(result.ok).toBe(true)
  expect(result.createsWarranty).toBe(true)
})

test('pending part closeout requires parts detail', () => {
  const result = validateJobCloseoutForm({ jobId: 'job-1', equipmentId: 'eq-1', realDiagnosis: 'Falla detectada', workDone: 'Diagnóstico realizado', finalState: 'pending_part', afterPhotosCount: 1 })
  expect(result.ok).toBe(false)
  expect(result.errors).toContain('pending_part_requires_parts_detail')
})

test('admin action validation requires audit-safe fields', () => {
  const result = validateAdminAction({ type: 'assign_professional', requestId: 'req', jobId: 'job', professionalId: 'pro', adminProfileId: 'admin', requestStatus: 'pending_assignment', jobStatus: 'pending_assignment' })
  expect(result.ok).toBe(true)
  expect(result.auditAction).toBe('admin.assign_professional')
})

test('admin pricing action rejects negative amount', () => {
  const result = validateAdminAction({ type: 'update_pricing', ruleId: 'rule', adminProfileId: 'admin', baseAmount: -1 })
  expect(result.ok).toBe(false)
  expect(result.errors).toContain('base_amount_invalid')
})
