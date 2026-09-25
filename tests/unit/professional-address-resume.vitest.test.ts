import { expect, it, vi } from 'vitest'
import type { Session } from '@/lib/auth/session'
import { readProfessionalReview } from '@/lib/professional/onboarding-service'

it('recovers the saved address alongside the existing strict review document', async () => {
  const professionalId = '96000000-0000-4000-8000-000000000001'
  const review = {
    application: {
      professionalId, version: 3, status: 'form_started', email: 'ana@example.com',
      firstName: 'Ana', lastName: 'Pérez', phone: '1122334455', dni: '12345678',
      cuil: '20123456789', birthdate: '1990-01-01', yearsExperience: 2,
      licenseNumber: 'MP-123', licenseEntity: 'Colegio', hasMobility: true,
      mobilityType: 'Auto', bio: '', categoryIds: [], zoneIds: [], tools: [], availability: []
    },
    requirements: null, documents: [], decisionReason: null, eligible: false
  }
  const single = vi.fn().mockResolvedValue({ data: { base_location: 'Calle Falsa 123, CABA' }, error: null })
  const select = vi.fn(() => ({ eq: () => ({ single }) }))
  const from = vi.fn(() => ({ select }))
  const rpc = vi.fn().mockResolvedValue({ data: review, error: null })
  const client = { rpc, from } as unknown as Session['client']
  const result = await readProfessionalReview(client)
  expect(result.application.address).toBe('Calle Falsa 123, CABA')
  expect(from).toHaveBeenCalledWith('professional_profiles')
  expect(select).toHaveBeenCalledWith('base_location')
})
