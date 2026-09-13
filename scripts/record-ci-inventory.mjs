import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

if (process.env.CI !== 'true') throw new Error('This receipt requires CI; local checks are not CI evidence')
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean).sort()
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
if (execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim()) throw new Error('Tracked source differs from candidate commit')
const hash = value => createHash('sha256').update(value).digest('hex')
const migrationFiles = files.filter(path => path.startsWith('supabase/migrations/') && path.endsWith('.sql'))
if (migrationFiles.length === 0 || !files.includes('pnpm-lock.yaml') || !files.includes('vendor/waltergaltieri-mercadopago-split-0.1.0.tgz')) throw new Error('Reproducible source inventory is incomplete')
const demoReferences = []
for (const path of files) {
  if (/(^|\/)\.env($|\.)/.test(path) && !/\.(example|template)$/.test(path)) throw new Error('Tracked environment file requires review')
  if (!/\.(?:ts|tsx|js|mjs|json|yml|yaml|sql|md)$/.test(path)) continue
  const content = readFileSync(path, 'utf8')
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) throw new Error('Possible private credential in tracked source; inspect securely')
  if (/^(?:app|lib|components)\//.test(path)) for (const [index, line] of content.split(/\r?\n/).entries()) if (/\b(?:demo|mock|simulated|fallbackData)\b/i.test(line)) demoReferences.push({ path, line: index + 1, disposition: 'requires-production-review' })
}
mkdirSync('output/ci', { recursive: true })
writeFileSync('output/ci/source-inventory.json', JSON.stringify({ schemaVersion: 1, commit, recordedAt: new Date().toISOString(), ciRun: process.env.GITHUB_RUN_ID ?? null, lockfileHash: hash(readFileSync('pnpm-lock.yaml')), vendorHash: hash(readFileSync('vendor/waltergaltieri-mercadopago-split-0.1.0.tgz')), migrationSetHash: hash(migrationFiles.map(path => `${path}\0${hash(readFileSync(path))}\n`).join('')), migrations: migrationFiles, pages: files.filter(path => /^app\/.*\/page\.tsx$/.test(path)), apis: files.filter(path => /^app\/api\/.*\/route\.ts$/.test(path)), demoReferences, gateStatus: 'pending', limitations: ['Inventory is not verified route disposition', 'Pattern scan is not a complete secret audit', 'Runtime/deploy, upgrade, provider and human evidence are separate requirements'] }, null, 2))
console.log('Candidate inventory recorded; route dispositions remain subject to production review')
