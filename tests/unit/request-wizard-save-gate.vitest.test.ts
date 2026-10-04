import { describe, expect, it } from 'vitest'
import { isSavedQuoteForCurrentInput } from '@/lib/service-request/wizard'

describe('request wizard quote-save gate', () => {
  it('only allows continuing when a persisted quote matches the current input', () => {
    expect(isSavedQuoteForCurrentInput('current-input', null)).toBe(false)
    expect(
      isSavedQuoteForCurrentInput('current-input', {
        id: 'quote-1',
        inputKey: 'previous-input'
      })
    ).toBe(false)
    expect(
      isSavedQuoteForCurrentInput('current-input', {
        id: 'quote-1',
        inputKey: 'current-input'
      })
    ).toBe(true)
  })
})
