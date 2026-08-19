import { describe, expect, it } from 'vitest'

import { classifySupportCase } from '../../lib/support/cases'

describe('classifySupportCase', () => {
  it('classifies safety cases as critical with a 10 minute SLA', () => {
    const result = classifySupportCase({
      source: 'customer',
      category: 'safety',
      description: 'The equipment is emitting sparks.'
    })

    expect(result.severity).toBe('critical')
    expect(result.slaMinutes).toBe(10)
  })

  it('classifies payment cases as high severity with a 30 minute SLA', () => {
    const result = classifySupportCase({
      source: 'customer',
      category: 'payment',
      description: 'The approved payment is blocked.'
    })

    expect(result.severity).toBe('high')
    expect(result.slaMinutes).toBe(30)
  })

  it('classifies delay cases as high severity with a 30 minute SLA', () => {
    const result = classifySupportCase({
      source: 'customer',
      category: 'delay',
      description: 'The professional has not arrived.'
    })

    expect(result.severity).toBe('high')
    expect(result.slaMinutes).toBe(30)
  })

  it('classifies quality cases as medium severity with a 120 minute SLA', () => {
    const result = classifySupportCase({
      source: 'customer',
      category: 'quality',
      description: 'The repair did not resolve the issue.'
    })

    expect(result.severity).toBe('medium')
    expect(result.slaMinutes).toBe(120)
  })

  it('rejects an empty description', () => {
    expect(() => classifySupportCase({
      source: 'customer',
      category: 'quality',
      description: '   '
    })).toThrow('support_case_description_required')
  })
})
