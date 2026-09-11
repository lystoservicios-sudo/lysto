import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { artifactVerifier, attestationPayload, attestationVerifier } from '../../lib/release/evidence-files.ts'
import { assertStagingTarget, verifyPlaywrightReport } from '../../lib/release/staging-evidence.ts'

describe('release evidence artifacts', () => {
  it('checks file contents and blocks missing, changed and escaped artifacts', () => {
    const root = mkdtempSync(join(tmpdir(), 'lysto-release-'))
    try {
      writeFileSync(join(root, 'report.json'), '{}')
      const verify = artifactVerifier(root)
      const evidence = { artifact: { path: 'report.json', sha256: createHash('sha256').update('{}').digest('hex') } }
      expect(verify(evidence)).toBe(true)
      writeFileSync(join(root, 'report.json'), '{"changed":true}')
      expect(verify(evidence)).toBe(false)
      expect(verify({ artifact: { ...evidence.artifact, path: '../report.json' } })).toBe(false)
      expect(verify({ artifact: { ...evidence.artifact, path: join(root, 'report.json') } })).toBe(false)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
  it('requires the authorized approver signature bound to the full evidence and gate', () => {
    const keys = generateKeyPairSync('ed25519')
    const evidence = { commit: 'a'.repeat(40), kind: 'human', attestation: { approver: 'operator', keyId: 'operator-key', reference: 'https://example.test/approval', signature: '' } }
    evidence.attestation.signature = sign(null, Buffer.from(attestationPayload('G10', evidence)), keys.privateKey).toString('base64')
    const verify = attestationVerifier({ keys: [{ id: 'operator-key', approver: 'operator', kind: 'human', gates: ['G10'], publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString() }] })
    expect(verify('G10', evidence)).toBe(true)
    expect(verify('G15', evidence)).toBe(false)
    expect(verify('G10', { ...evidence, commit: 'b'.repeat(40) })).toBe(false)
    expect(verify('G10', { ...evidence, attestation: { ...evidence.attestation, approver: 'agent' } })).toBe(false)
    expect(attestationVerifier({ keys: [] })('G10', evidence)).toBe(false)
  })
})

describe('staging evidence', () => {
  const identity = { production: false, environment: 'staging', origin: 'https://staging.example.test', projectRef: 'abcdefghijklmnopqrst', testResources: ['qa-customer', 'qa-professional', 'qa-operator'] }
  const env = { APP_ENV: 'staging', LYSTO_E2E_BASE_URL: identity.origin, NEXT_PUBLIC_SUPABASE_URL: `https://${identity.projectRef}.supabase.co`, MERCADOPAGO_MODE: 'test' }
  it('requires explicit staging origin, project and test resources', () => {
    expect(assertStagingTarget(env, identity).origin).toBe(identity.origin)
    for (const changed of [{ ...env, APP_ENV: 'production' }, { ...env, LYSTO_E2E_BASE_URL: 'https://production.example.test' }, { ...env, NEXT_PUBLIC_SUPABASE_URL: 'https://other.supabase.co' }, { ...env, MERCADOPAGO_MODE: 'live' }]) expect(() => assertStagingTarget(changed, identity)).toThrow()
    expect(() => assertStagingTarget(env, { ...identity, production: true })).toThrow()
    expect(() => assertStagingTarget(env, { ...identity, testResources: [] })).toThrow()
  })
  it('rejects zero tests, skipped cases and partial execution', () => {
    const report = { suites: [{ specs: [{ tests: [{ results: [{ status: 'passed' }] }] }] }], stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 } }
    expect(verifyPlaywrightReport(report, false)).toBe(1)
    expect(() => verifyPlaywrightReport({ suites: [], stats: report.stats }, false)).toThrow()
    expect(() => verifyPlaywrightReport({ ...report, stats: { ...report.stats, skipped: 1 } }, false)).toThrow()
    expect(() => verifyPlaywrightReport({ ...report, suites: [{ specs: [{ tests: [{ results: [] }] }] }] }, false)).toThrow()
    expect(verifyPlaywrightReport({ suites: report.suites }, true)).toBe(1)
  })
})
