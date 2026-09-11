import { readFileSync } from 'node:fs'
import { verifyIntegrationReport } from './lib/integration-report.mjs'

// Reuse the Vitest result contract without the database-only suite inventory.
const count = verifyIntegrationReport(JSON.parse(readFileSync('output/ci/unit.json', 'utf8')), true)
console.log(`Unit acceptance: ${count} tests; zero skipped, todo or failed`)
