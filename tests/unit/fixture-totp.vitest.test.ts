import { expect, it } from 'vitest'
import { fixtureTotp } from '../integration/mfa'

it('matches the six-digit suffix of the public RFC 6238 SHA-1 test vector', () => {
  expect(fixtureTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59000)).toBe('287082')
  expect(fixtureTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 1111111109000)).toBe('081804')
})
