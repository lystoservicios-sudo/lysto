import { expect, test } from '../_lib/test.ts'
import { evaluateReleaseGates, MVP_RELEASE_GATES, RELEASE_GATE_CATALOG } from '../../lib/release/release-gates.ts'
import { verifyPlaywrightCoverage } from '../../lib/release/staging-evidence.ts'
import { artifactVerifier, attestationPayload, attestationVerifier } from '../../lib/release/evidence-files.ts'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash, generateKeyPairSync, sign } from 'node:crypto'

test('release gates prevent launch while external secrets and CI are pending', () => {
  const decision = evaluateReleaseGates(MVP_RELEASE_GATES)
  expect(decision.canLaunch).toBe(false)
  expect(decision.blockers.length).toBeGreaterThan(0)
})

test('release gates do not treat caller booleans as release evidence', () => {
  const decision = evaluateReleaseGates(MVP_RELEASE_GATES.map((gate) => ({ ...gate, passed: true })))
  expect(decision.canLaunch).toBe(false)
  expect(decision.blockers.length).toBeGreaterThan(0)
})

test('release gates reject an empty list', () => {
  expect(evaluateReleaseGates([]).canLaunch).toBe(false)
})

const context = { releaseId: 'candidate-1', commit: 'a'.repeat(40), migrationSetHash: 'b'.repeat(64), environment: 'staging', target: 'technical' as const, now: Date.parse('2026-09-11T12:00:00Z'), verifyArtifact: () => true, verifyAttestation: () => true }
function manifest() {
  return { schemaVersion: 1, releaseId: context.releaseId, commit: context.commit, migrationSetHash: context.migrationSetHash, environment: context.environment, gates: RELEASE_GATE_CATALOG.map(gate => ({ id: gate.id, status: 'passed', evidence: gate.kinds.map(kind => ({ schemaVersion: 1, releaseId: context.releaseId, commit: context.commit, migrationSetHash: context.migrationSetHash, environment: context.environment, executionEnvironment: gate.environments[0], recordedAt: '2026-09-11T11:00:00Z', command: 'recorded-command', exitCode: 0, kind, artifact: { path: `${gate.id}-${kind}.json`, sha256: 'c'.repeat(64) }, counts: { passed: 1, failed: 0, skipped: 0 }, attestation: { approver: 'test-approver', reference: 'https://example.test/review', signature: 'test-signature', keyId: 'test-key' } })) })) }
}

test('release requires a fixed catalog and independently verified evidence', () => {
  expect(evaluateReleaseGates(manifest(), context).canLaunch).toBe(true)
  expect(evaluateReleaseGates(manifest(), { ...context, verifyArtifact: () => false }).canLaunch).toBe(false)
  expect(evaluateReleaseGates(manifest(), { ...context, verifyAttestation: () => false }).canLaunch).toBe(false)
  expect(evaluateReleaseGates(manifest()).canLaunch).toBe(false)
})

for (const mutation of ['empty', 'missing', 'duplicate', 'unknown', 'commit', 'environment', 'release', 'migration', 'version', 'expired', 'future', 'skip', 'failed', 'zero', 'exit', 'artifact', 'kind', 'pending', 'unknownStatus', 'missingHuman', 'forgedApproval', 'wrongExecution', 'duplicateEvidence'] as const) {
  test(`release blocks ${mutation} evidence`, () => {
    const input = manifest()
    const evidence = input.gates[0].evidence[0]
    switch (mutation) {
      case 'empty': input.gates = []; break
      case 'missing': input.gates.pop(); break
      case 'duplicate': input.gates.push(input.gates[0]); break
      case 'unknown': input.gates[0].id = 'G99'; break
      case 'commit': evidence.commit = 'd'.repeat(40); break
      case 'environment': evidence.environment = 'production'; break
      case 'release': evidence.releaseId = 'other'; break
      case 'migration': evidence.migrationSetHash = 'd'.repeat(64); break
      case 'version': evidence.schemaVersion = 2; break
      case 'expired': evidence.recordedAt = '2020-01-01T00:00:00Z'; break
      case 'future': evidence.recordedAt = '2030-01-01T00:00:00Z'; break
      case 'skip': evidence.counts.skipped = 1; break
      case 'failed': evidence.counts.failed = 1; break
      case 'zero': evidence.counts.passed = 0; break
      case 'exit': evidence.exitCode = 1; break
      case 'artifact': evidence.artifact.path = ''; break
      case 'kind': evidence.kind = 'human'; break
      case 'pending': input.gates[0].status = 'pending'; break
      case 'unknownStatus': input.gates[0].status = 'unknown'; break
      case 'missingHuman': input.gates[9].evidence = input.gates[9].evidence.filter(item => item.kind !== 'human'); break
      case 'forgedApproval': input.gates[9].evidence[1].attestation.signature = ''; break
      case 'wrongExecution': evidence.executionEnvironment = 'production'; break
      case 'duplicateEvidence': input.gates[0].evidence.push(evidence); break
    }
    expect(evaluateReleaseGates(input, context).canLaunch).toBe(false)
  })
}

test('technical does not imply pilot or general release', () => {
  const input = manifest()
  for (const gate of input.gates.slice(13)) { gate.status = 'pending'; gate.evidence = [] }
  expect(evaluateReleaseGates(input, context).canLaunch).toBe(true)
  expect(evaluateReleaseGates(input, { ...context, target: 'pilot' }).canLaunch).toBe(false)
  expect(evaluateReleaseGates(input, { ...context, target: 'general' }).canLaunch).toBe(false)
})

const coverage = { files: ['auth-access.spec.ts', 'customer-production.spec.ts'], projects: ['chromium-mobile', 'webkit-mobile', 'chromium-desktop'] }
function playwrightReport() {
  return { suites: coverage.files.map(file => ({ specs: [{ id: file, file, tests: coverage.projects.map(projectName => ({ projectName, results: [{ status: 'passed' }] })) }] })), stats: { expected: 6, unexpected: 0, flaky: 0, skipped: 0 } }
}

test('staging requires discovered and executed cases for each mandatory suite and browser project', () => {
  const report = playwrightReport()
  expect(verifyPlaywrightCoverage(report, report, coverage)).toBe(6)
  const missingSuite = playwrightReport()
  missingSuite.suites.pop()
  missingSuite.stats.expected = 3
  expect(() => verifyPlaywrightCoverage(missingSuite, undefined, coverage)).toThrow()
  const missingProject = playwrightReport()
  missingProject.suites[0].specs[0].tests.pop()
  missingProject.stats.expected = 5
  expect(() => verifyPlaywrightCoverage(missingProject, undefined, coverage)).toThrow()
})

test('staging rejects changed or duplicate discovered test identities despite equal counts', () => {
  const listed = playwrightReport()
  const changed = playwrightReport()
  changed.suites[0].specs[0].id = 'another-case'
  expect(() => verifyPlaywrightCoverage(listed, changed, coverage)).toThrow()
  const duplicate = playwrightReport()
  duplicate.suites[0].specs[0].tests[1].projectName = duplicate.suites[0].specs[0].tests[0].projectName
  expect(() => verifyPlaywrightCoverage(duplicate, undefined, coverage)).toThrow()
})

test('staging rejects seven empty required files plus a passing legacy test', () => {
  const legacy = { suites: [{ specs: [{ id: 'legacy', file: 'customer-flow.spec.ts', tests: [{ projectName: 'chromium-mobile', results: [{ status: 'passed' }] }] }] }], stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 } }
  expect(() => verifyPlaywrightCoverage(legacy, legacy, coverage)).toThrow()
})

test('automated artifacts must bind an actual passing report to the candidate execution record', () => {
  const root = mkdtempSync(join(tmpdir(), 'lysto-execution-test-'))
  try {
    const digest = (value: string) => createHash('sha256').update(value).digest('hex')
    const report = JSON.stringify({ checks: [{ id: 'build', command: 'pnpm build', exitCode: 0, status: 'passed' }] })
    writeFileSync(join(root, 'report.json'), report)
    const evidence = { schemaVersion: 1, kind: 'automated', releaseId: 'candidate', commit: 'a'.repeat(40), migrationSetHash: 'b'.repeat(64), environment: 'staging', executionEnvironment: 'ci', recordedAt: '2026-09-11T12:00:00Z', command: 'pnpm build', exitCode: 0, counts: { passed: 1, failed: 0, skipped: 0 }, artifact: { path: 'execution.json', sha256: '' } }
    const record = { schemaVersion: 1, type: 'lysto.execution', gateId: 'G01', releaseId: evidence.releaseId, commit: evidence.commit, migrationSetHash: evidence.migrationSetHash, environment: evidence.environment, executionEnvironment: evidence.executionEnvironment, recordedAt: evidence.recordedAt, command: evidence.command, exitCode: 0, report: { format: 'checks', path: 'report.json', sha256: digest(report) } }
    const check = (value: unknown) => { const data = JSON.stringify(value); writeFileSync(join(root, 'execution.json'), data); return artifactVerifier(root)({ ...evidence, artifact: { ...evidence.artifact, sha256: digest(data) } }, 'G01') }
    expect(check(record)).toBe(true)
    expect(check({})).toBe(false)
    expect(check({ ...record, commit: 'c'.repeat(40) })).toBe(false)
    expect(check({ ...record, gateId: 'G02' })).toBe(false)
    for (const invalid of [{}, { checks: [] }, { checks: [{ id: 'build', command: 'pnpm build', exitCode: 1, status: 'failed' }] }, { checks: [{ id: 'build', command: '', exitCode: 0, status: 'passed' }] }]) {
      const data = JSON.stringify(invalid)
      writeFileSync(join(root, 'report.json'), data)
      expect(check({ ...record, report: { ...record.report, sha256: digest(data) } })).toBe(false)
    }
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('human signing keys cannot approve automated execution records', () => {
  const keys = generateKeyPairSync('ed25519')
  const evidence = { kind: 'automated', attestation: { approver: 'runner', keyId: 'runner', reference: 'https://example.test/run/1', signature: '' } }
  evidence.attestation.signature = sign(null, Buffer.from(attestationPayload('G01', evidence)), keys.privateKey).toString('base64')
  const key = { id: 'runner', approver: 'runner', kind: 'automated', gates: ['G01'], publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString() }
  expect(attestationVerifier({ keys: [key] })('G01', evidence)).toBe(true)
  expect(attestationVerifier({ keys: [{ ...key, kind: 'human' }] })('G01', evidence)).toBe(false)
})
