export function verifyIntegrationReport(report, filtered = false) {
  if (report?.success !== true || !Number.isInteger(report.numTotalTests) || report.numTotalTests < 1 || report.numPendingTests || report.numTodoTests || report.numFailedTests || report.numPassedTests !== report.numTotalTests) throw new Error('Integration requires executed tests with zero skips, todos or failures')
  if (!filtered) {
    const required = [
      ['tests/unit/marketplace-ledger.vitest.test.ts', 7],
      ['tests/unit/marketplace-storage.vitest.test.ts', 1],
      ['tests/integration/identity-isolation.test.ts', 3]
    ]
    for (const [path, minimum] of required) {
      const suite = report.testResults?.find(result => result.name.replaceAll('\\', '/').endsWith(path))
      if (!suite || suite.status !== 'passed' || suite.assertionResults?.filter(test => test.status === 'passed').length < minimum) throw new Error(`Mandatory integration evidence missing: ${path}`)
    }
  }
  return report.numPassedTests
}
