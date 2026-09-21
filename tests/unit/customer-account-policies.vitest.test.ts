import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  canonicalPolicyText,
  customerPrivacyPolicy,
  customerTermsPolicy
} from '@/lib/legal/customer-account-policies'

describe('published customer account policies', () => {
  it.each([
    ['terms', customerTermsPolicy, '96f54f1c8f4e8d5d1a97cc3da7cc4824b8ed2502cbd76031811b210fd0047e2f'],
    ['privacy', customerPrivacyPolicy, '356f64084c777590003daaeaa688374e365c89d47e93909c8e7d4ff9035d7819']
  ] as const)('keeps the approved %s content immutable', (_kind, policy, expectedHash) => {
    const actualHash = createHash('sha256').update(canonicalPolicyText(policy), 'utf8').digest('hex')
    expect(policy.version).toBe('2026-09-21')
    expect(actualHash).toBe(expectedHash)
  })
})
