import { readFileSync } from 'node:fs'
import { verifyPlaywrightCoverage } from '../../lib/release/staging-evidence.ts'

try {
  if (process.argv.length !== 4) throw new Error('List and execution reports are required')
  const executed = verifyPlaywrightCoverage(JSON.parse(readFileSync(process.argv[2], 'utf8')), JSON.parse(readFileSync(process.argv[3], 'utf8')), { files: [], projects: [] })
  console.log(`E2E acceptance: ${executed} tests, zero skipped or failed`)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Invalid Playwright evidence')
  process.exitCode = 1
}
