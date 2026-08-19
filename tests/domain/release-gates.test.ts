import { expect, test } from '../_lib/test.ts'
import { evaluateReleaseGates, MVP_RELEASE_GATES } from '../../lib/release/release-gates.ts'

test('release gates prevent launch while external secrets and CI are pending', () => {
  const decision = evaluateReleaseGates(MVP_RELEASE_GATES)
  expect(decision.canLaunch).toBe(false)
  expect(decision.blockers.length).toBeGreaterThan(0)
})

test('release gates allow launch only when all required pass', () => {
  const decision = evaluateReleaseGates(MVP_RELEASE_GATES.map((gate) => ({ ...gate, passed: true })))
  expect(decision.canLaunch).toBe(true)
  expect(decision.blockers.length).toBe(0)
})
