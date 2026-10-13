import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'))

// https://github.com/vercel/next.js/releases/tag/v15.5.27 fixes
// GHSA-4jqv-mc3x-m676 and GHSA-mcj8-r9mp-w47p without a major-version migration.
test('Next 15.5 stays on the reviewed security patch baseline', () => {
  const version = manifest.dependencies.next
  const match = /^15\.5\.(\d+)$/.exec(version)
  assert.ok(match, 'Keep the reviewed Next 15.5 line pinned to an exact stable patch')
  assert.ok(Number(match[1]) >= 27, 'Next below 15.5.27 is affected by the cache-poisoning advisories')
  assert.equal(manifest.devDependencies['eslint-config-next'], version)
})

test('the Next patch keeps the reviewed image and CSS runtime overrides active', () => {
  const overrides = manifest.pnpm.overrides
  const version = manifest.dependencies.next
  assert.equal(manifest.dependencies.sharp, '0.35.5')
  assert.equal(overrides[`next@${version}>sharp`], '0.35.5')
  assert.equal(overrides[`next@${version}>postcss`], '8.5.26')
  assert.equal(overrides['source-map-js'], '1.2.2')
})
