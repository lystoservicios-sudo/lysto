import { describe, expect, it } from 'vitest'
import { calculatePreliminaryDiagnosis } from '@/lib/diagnosis/preliminary'

describe('preliminary diagnosis calculation', () => {
  it('identifies the result without claiming persistence', () => {
    expect(
      calculatePreliminaryDiagnosis({ issue: 'no_enfria', timeSince: 'weeks', hasPhoto: true })
    ).toMatchObject({
      kind: 'preliminary_calculation',
      persisted: false,
      diagnosis: { issue: 'no_enfria', disclaimer: expect.stringContaining('preliminar') }
    })
  })
  it('rejects extra caller fields', () => {
    expect(() =>
      calculatePreliminaryDiagnosis({ issue: 'no_enfria', timeSince: 'weeks', actorId: 'forged' })
    ).toThrow()
  })
})
