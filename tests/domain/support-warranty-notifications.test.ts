import { test, expect } from '../_lib/test.ts'
import { classifySupportCase } from '../../lib/support/cases.ts'
import { evaluateWarrantyClaim } from '../../lib/warranty/claims.ts'
import { buildNotificationTemplate } from '../../lib/notifications/templates.ts'

test('support case classifies safety risk as critical', () => {
  const result = classifySupportCase({ source: 'customer', category: 'safety', description: 'Chispazos en unidad interior', hasSafetyRisk: true })
  expect(result.severity).toBe('critical')
  expect(result.slaMinutes).toBe(10)
})

test('warranty claim is accepted inside warranty window for same problem', () => {
  const result = evaluateWarrantyClaim({ jobId: 'JOB-1', customerId: 'CUS-1', completedAt: '2026-08-01', warrantyDays: 30, claimDate: '2026-08-20', description: 'Volvió el mismo problema', sameProblem: true })
  expect(result.acceptedForReview).toBe(true)
  expect(result.daysSinceCompletion).toBe(19)
})

test('warranty claim rejects expired claims', () => {
  const result = evaluateWarrantyClaim({ jobId: 'JOB-1', customerId: 'CUS-1', completedAt: '2026-08-01', warrantyDays: 7, claimDate: '2026-08-20', description: 'Volvió el problema', sameProblem: true })
  expect(result.acceptedForReview).toBe(false)
  expect(result.reason).toBe('warranty_expired')
})

test('notification template for professional confirmed', () => {
  const result = buildNotificationTemplate({ audience: 'customer', event: 'professional_confirmed', professionalName: 'Martin', serviceLabel: 'aire acondicionado' })
  expect(result.title).toBe('Técnico confirmado')
  expect(result.channelPriority.includes('whatsapp')).toBe(true)
})
