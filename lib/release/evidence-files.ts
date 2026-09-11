import { createHash, createPublicKey, verify } from 'node:crypto'
import { readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { verifyPlaywrightReport } from './staging-evidence.ts'

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
export function artifactVerifier(root: string) {
  const base = realpathSync(root)
  const readArtifact = (artifact: unknown): Buffer | undefined => {
    try {
      if (!object(artifact) || typeof artifact.path !== 'string' || !artifact.path || isAbsolute(artifact.path) || /^[a-z]:|\\/i.test(artifact.path) || !/^[a-f0-9]{64}$/.test(String(artifact.sha256))) return undefined
      const target = realpathSync(resolve(base, artifact.path))
      const path = relative(base, target)
      if (!path || isAbsolute(path) || path === '..' || path.startsWith(`..${sep}`)) return undefined
      const stat = statSync(target)
      if (!stat.isFile() || stat.size === 0 || stat.size > 100 * 1024 * 1024) return undefined
      const data = readFileSync(target)
      return createHash('sha256').update(data).digest('hex') === artifact.sha256 ? data : undefined
    } catch { return undefined }
  }
  return (evidence: Record<string, unknown>, gateId?: string) => {
    try {
      const data = readArtifact(evidence.artifact)
      if (!data) return false
      if (evidence.kind !== 'automated') return true
      const execution = JSON.parse(data.toString('utf8')) as unknown
      if (!object(execution) || execution.schemaVersion !== 1 || execution.type !== 'lysto.execution' || !gateId || execution.gateId !== gateId || !object(execution.report)) return false
      for (const key of ['schemaVersion', 'releaseId', 'commit', 'migrationSetHash', 'environment', 'executionEnvironment', 'recordedAt', 'command', 'exitCode']) if (execution[key] !== evidence[key]) return false
      if (execution.exitCode !== 0) return false
      const reportData = readArtifact(execution.report)
      if (!reportData) return false
      const report = JSON.parse(reportData.toString('utf8')) as unknown
      let passed = 0
      if (execution.report.format === 'playwright') passed = verifyPlaywrightReport(report, false)
      else if (execution.report.format === 'vitest') {
        if (!object(report) || report.success !== true || !Number.isInteger(report.numTotalTests) || Number(report.numTotalTests) <= 0 || report.numPassedTests !== report.numTotalTests || report.numFailedTests !== 0 || report.numPendingTests !== 0 || report.numTodoTests !== 0 || !Array.isArray(report.testResults)) return false
        for (const suite of report.testResults) {
          if (!object(suite) || suite.status !== 'passed' || !Array.isArray(suite.assertionResults)) return false
          for (const test of suite.assertionResults) { if (!object(test) || test.status !== 'passed') return false; passed += 1 }
        }
        if (passed !== report.numTotalTests) return false
      } else if (execution.report.format === 'checks') {
        if (!object(report) || !Array.isArray(report.checks) || report.checks.length === 0) return false
        const ids = new Set<string>()
        for (const check of report.checks) {
          if (!object(check) || typeof check.id !== 'string' || !check.id.trim() || ids.has(check.id) || typeof check.command !== 'string' || !check.command.trim() || check.exitCode !== 0 || check.status !== 'passed') return false
          ids.add(check.id); passed += 1
        }
      } else return false
      return object(evidence.counts) && passed > 0 && evidence.counts.passed === passed && evidence.counts.failed === 0 && evidence.counts.skipped === 0
    } catch { return false }
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]))
  return value
}

export function attestationPayload(gate: string, evidence: Record<string, unknown>) {
  const attestation = object(evidence.attestation) ? { ...evidence.attestation } : {}
  delete attestation.signature
  return JSON.stringify(canonical({ gate, evidence: { ...evidence, attestation } }))
}

export function attestationVerifier(policy: unknown) {
  if (!object(policy) || !Array.isArray(policy.keys)) throw new Error('Invalid external trust policy')
  const keys = new Map<string, { approver: string; kind: string; gates: string[]; publicKey: string }>()
  for (const key of policy.keys) {
    if (!object(key) || typeof key.id !== 'string' || !key.id || keys.has(key.id) || typeof key.approver !== 'string' || !key.approver || !Array.isArray(key.gates) || key.gates.length === 0 || key.gates.some(gate => typeof gate !== 'string' || !/^G(?:0[1-9]|1[0-6])$/.test(gate)) || typeof key.publicKey !== 'string' || createPublicKey(key.publicKey).asymmetricKeyType !== 'ed25519') throw new Error('Invalid external approver key')
    if (typeof key.kind !== 'string' || !['human', 'provider', 'automated'].includes(key.kind)) throw new Error('Trusted keys must authorize an explicit evidence kind')
    keys.set(key.id, { approver: key.approver, kind: key.kind, gates: key.gates, publicKey: key.publicKey })
  }
  return (gate: string, evidence: Record<string, unknown>) => {
    try {
      if (!object(evidence.attestation)) return false
      const attestation = evidence.attestation
      const key = keys.get(String(attestation.keyId))
      if (!key || evidence.kind !== key.kind || attestation.approver !== key.approver || !key.gates.includes(gate) || typeof attestation.reference !== 'string' || typeof attestation.signature !== 'string') return false
      const reference = new URL(attestation.reference)
      if (reference.protocol !== 'https:' || reference.username || reference.password) return false
      const signature = Buffer.from(attestation.signature, 'base64')
      if (signature.length !== 64) return false
      return verify(null, Buffer.from(attestationPayload(gate, evidence)), key.publicKey, signature)
    } catch { return false }
  }
}
