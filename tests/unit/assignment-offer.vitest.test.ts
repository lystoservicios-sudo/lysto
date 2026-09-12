import { describe, expect, it } from 'vitest'
import { decideOfferResponse, validateOfferExpiry } from '@/lib/admin/assignment'
import { rankProfessionals, type ProfessionalCandidate } from '@/lib/matching/score-professionals'

describe('assignment offer lifecycle', () => {
  it('bounds offer expiry and rejects already expired offers', () => {
    const now = new Date('2026-09-12T12:00:00Z')
    expect(validateOfferExpiry('2026-09-12T12:30:00Z', now)).toBe('2026-09-12T12:30:00.000Z')
    expect(() => validateOfferExpiry('2026-09-12T11:59:59Z', now)).toThrow('offer_expired')
    expect(() => validateOfferExpiry('2026-09-12T15:00:00Z', now)).toThrow('offer_expiry_too_far')
  })

  it('makes repeated acceptance idempotent but rejects a late acceptance', () => {
    const now = new Date('2026-09-12T12:00:00Z')
    expect(decideOfferResponse('accepted', 'accepted', '2026-09-12T12:30:00Z', now)).toBe(
      'accepted'
    )
    expect(() => decideOfferResponse('expired', 'accepted', '2026-09-12T11:59:00Z', now)).toThrow(
      'offer_expired'
    )
  })

  it('requires a useful rejection reason', () => {
    expect(() =>
      decideOfferResponse(
        'pending',
        'rejected',
        '2026-09-12T12:30:00Z',
        new Date('2026-09-12T12:00:00Z'),
        'no'
      )
    ).toThrow('rejection_reason_required')
  })

  it('uses a deterministic id tie-breaker for equally ranked eligible candidates', () => {
    const base: ProfessionalCandidate = {
      id: 'b',
      name: 'Pro',
      status: 'approved',
      serviceSlugs: ['aire'],
      zones: ['caba'],
      available: true,
      hasLicense: true,
      toolsScore: 10,
      ratingAvg: 5,
      jobsCompleted: 20,
      activeJobs: 0,
      acceptanceRate: 1,
      distanceKm: 2,
      internalScore: 10
    }
    expect(
      rankProfessionals(
        [
          { ...base, id: 'b' },
          { ...base, id: 'a' }
        ],
        {
          serviceSlug: 'aire',
          zone: 'caba'
        }
      ).map((candidate) => candidate.id)
    ).toEqual(['a', 'b'])
  })
})
