import { test, expect } from '../_lib/test.ts'
import { handleProfessionalResponse } from '../../lib/professional/request-response.ts'

test('professional accepts assigned job', () => {
  const result = handleProfessionalResponse({ professionalId: 'PRO-1', assignedProfessionalId: 'PRO-1', requestStatus: 'pending_professional_acceptance', jobStatus: 'pending_professional_acceptance', response: 'accept' })
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.nextJobStatus).toBe('confirmed')
})

test('professional rejection requires reason', () => {
  const result = handleProfessionalResponse({ professionalId: 'PRO-1', assignedProfessionalId: 'PRO-1', requestStatus: 'pending_professional_acceptance', jobStatus: 'pending_professional_acceptance', response: 'reject' })
  expect(result.ok).toBe(false)
})

test('different professional cannot accept job', () => {
  const result = handleProfessionalResponse({ professionalId: 'PRO-2', assignedProfessionalId: 'PRO-1', requestStatus: 'pending_professional_acceptance', jobStatus: 'pending_professional_acceptance', response: 'accept' })
  expect(result.ok).toBe(false)
})
