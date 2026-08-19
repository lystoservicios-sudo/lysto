import { test, expect } from '../_lib/test.ts'
import { isEligible, rankProfessionals, type ProfessionalCandidate } from '../../lib/matching/score-professionals.ts'

const base: ProfessionalCandidate = { id: 'pro-1', name: 'Martin', status: 'approved', serviceSlugs: ['aire_acondicionado'], zones: ['caba'], available: true, hasLicense: true, toolsScore: 8, ratingAvg: 4.8, jobsCompleted: 30, activeJobs: 0, acceptanceRate: 0.9, distanceKm: 3, internalScore: 80 }

test('solo profesionales aprobados y aptos son elegibles', () => {
  expect(isEligible(base, { serviceSlug: 'aire_acondicionado', zone: 'caba' })).toBeTruthy()
  expect(isEligible({ ...base, status: 'suspended' }, { serviceSlug: 'aire_acondicionado', zone: 'caba' })).toBeFalsy()
  expect(isEligible({ ...base, hasLicense: false }, { serviceSlug: 'aire_acondicionado', zone: 'caba' })).toBeFalsy()
})

test('ranking ordena por score y filtra no aptos', () => {
  const ranked = rankProfessionals([
    { ...base, id: 'low', ratingAvg: 3.5, distanceKm: 12, activeJobs: 2, internalScore: 40 },
    { ...base, id: 'high', ratingAvg: 4.9, distanceKm: 2, activeJobs: 0, internalScore: 95 },
    { ...base, id: 'bad', status: 'under_review' }
  ], { serviceSlug: 'aire_acondicionado', zone: 'caba' })
  expect(ranked.length).toBe(2)
  expect(ranked[0].id).toBe('high')
})
