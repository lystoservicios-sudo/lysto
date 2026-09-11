import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, realpathSync, readdirSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { evaluateReleaseGates } from '../../lib/release/release-gates.ts'
import type { ReleaseTarget } from '../../lib/release/release-gates.ts'
import { artifactVerifier, attestationVerifier } from '../../lib/release/evidence-files.ts'

try {
  const args = process.argv.slice(2).filter(arg => arg !== '--')
  if (args.length === 1 && args[0] === '--self-test-blocking') {
    const result = evaluateReleaseGates({ schemaVersion: 1, gates: [] }, { target: 'technical', releaseId: 'negative-control', commit: 'a'.repeat(40), migrationSetHash: 'b'.repeat(64), environment: 'staging', now: Date.now(), verifyArtifact: () => false, verifyAttestation: () => false })
    if (result.canLaunch || result.blockers.length === 0) throw new Error('Incomplete manifest was incorrectly accepted')
    console.log(JSON.stringify({ negativeControl: 'passed', canLaunch: false, blockers: result.blockers }))
  } else {
    const options = new Map<string, string>()
    const allowed = ['--manifest', '--target', '--release-id', '--environment', '--trust-policy']
    for (let index = 0; index < args.length; index += 2) {
      if (!allowed.includes(args[index]) || !args[index + 1] || args[index + 1].startsWith('--') || options.has(args[index])) throw new Error('Invalid or duplicate release arguments')
      options.set(args[index], args[index + 1])
    }
    if (allowed.some(key => !options.has(key))) throw new Error('Required: --manifest --target --release-id --environment --trust-policy')
    if (!['technical', 'pilot', 'general'].includes(options.get('--target')!)) throw new Error('Unknown release target')
    const root = realpathSync(process.cwd())
    const trustFile = realpathSync(resolve(options.get('--trust-policy')!))
    const trustRelative = relative(root, trustFile)
    if (!isAbsolute(trustRelative) && trustRelative !== '..' && !trustRelative.startsWith(`..${sep}`)) throw new Error('Trust policy must come from outside the candidate checkout')
    if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) throw new Error('Release checks require a clean candidate checkout')
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
    const migrations = readdirSync('supabase/migrations').filter(path => path.endsWith('.sql')).sort()
    if (migrations.length === 0) throw new Error('Migration set is empty')
    const migrationSetHash = hash(migrations.map(path => `supabase/migrations/${path}\0${hash(readFileSync(`supabase/migrations/${path}`))}\n`).join(''))
    const manifestPath = realpathSync(resolve(options.get('--manifest')!))
    const result = evaluateReleaseGates(JSON.parse(readFileSync(manifestPath, 'utf8')), { target: options.get('--target') as ReleaseTarget, releaseId: options.get('--release-id')!, environment: options.get('--environment')!, commit, migrationSetHash, now: Date.now(), verifyArtifact: artifactVerifier(dirname(manifestPath)), verifyAttestation: attestationVerifier(JSON.parse(readFileSync(trustFile, 'utf8'))) })
    console.log(JSON.stringify({ target: options.get('--target'), commit, ...result }, null, 2))
    if (!result.canLaunch) process.exitCode = 1
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Release evidence verification failed')
  process.exitCode = 1
}
