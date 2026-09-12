import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { buildReleaseManifest, hashMigrationSet } from '../../scripts/create-release-manifest.mjs'

test('release manifest starts NO-GO with all sixteen unique pending gates', () => {
  const manifest = buildReleaseManifest({
    releaseId: 'candidate-test',
    environment: 'production',
    commit: 'a'.repeat(40),
    migrationSetHash: 'b'.repeat(64),
    createdAt: '2026-09-12T00:00:00.000Z',
  })
  assert.equal(manifest.decision, 'NO_GO')
  assert.deepEqual(manifest.gates.map(gate => gate.id), Array.from({ length: 16 }, (_, index) => `G${String(index + 1).padStart(2, '0')}`))
  assert.equal(new Set(manifest.gates.map(gate => gate.id)).size, 16)
  assert.ok(manifest.gates.every(gate => gate.status === 'pending' && gate.evidence.length === 0))
})

test('migration set hash changes with filename or content', () => {
  const first = mkdtempSync(join(tmpdir(), 'lysto-release-a-'))
  const second = mkdtempSync(join(tmpdir(), 'lysto-release-b-'))
  for (const directory of [first, second]) mkdirSync(join(directory, 'supabase', 'migrations'), { recursive: true })
  writeFileSync(join(first, 'supabase', 'migrations', '001.sql'), 'select 1;')
  writeFileSync(join(second, 'supabase', 'migrations', '001.sql'), 'select 2;')
  assert.notEqual(hashMigrationSet(first), hashMigrationSet(second))
})

test('production documents keep launch closed until authenticated approval', async () => {
  const [runbook, decision] = await Promise.all([
    readFile(new URL('../../docs/release/production-runbook.md', import.meta.url), 'utf8'),
    readFile(new URL('../../docs/release/go-no-go.md', import.meta.url), 'utf8'),
  ])
  assert.match(runbook, /LYSTO_ACCEPT_NEW_REQUESTS=false/)
  assert.match(runbook, /LYSTO_ALLOW_NEW_CHECKOUTS=false/)
  assert.match(runbook, /G01–G15 vigentes/)
  assert.match(runbook, /Preservar servicios existentes, recepción de eventos, outbox, ledger/)
  assert.match(decision, /Estado actual: \*\*NO-GO\*\*/)
  assert.match(decision, /El autor del cambio no puede autoemitir esas aprobaciones/)
})
