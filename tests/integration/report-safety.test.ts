import { describe, expect, it } from 'vitest'
import { verifyIntegrationReport } from '../../scripts/lib/integration-report.mjs'

const successful = { success: true, numTotalTests: 1, numPassedTests: 1, numPendingTests: 0, numTodoTests: 0, numFailedTests: 0, testResults: [] }
describe('mandatory integration evidence', () => {
  it('rejects a green partial report as a full integration run', () => {
    expect(() => verifyIntegrationReport(successful, false)).toThrow()
  })
  it('rejects empty or skipped filtered runs', () => {
    expect(() => verifyIntegrationReport({ ...successful, numTotalTests: 0 }, true)).toThrow()
    expect(() => verifyIntegrationReport({ ...successful, numPendingTests: 1 }, true)).toThrow()
  })
  it('accepts explicitly filtered runs without claiming the full mandatory suite', () => {
    expect(verifyIntegrationReport(successful, true)).toBe(1)
  })
})
