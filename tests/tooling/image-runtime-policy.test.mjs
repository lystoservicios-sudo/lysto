import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const nextRequire = createRequire(require.resolve('next/package.json'))
const script = new URL('../../scripts/verify-image-runtime.mjs', import.meta.url).href

function runRuntime(heifOverride) {
  const metadataOverride = heifOverride === undefined ? '' : `
    const sharp = nextRequire('sharp');
    sharp.versions.heif = ${JSON.stringify(heifOverride)};
  `
  // Isolate Sharp's native loader policy per process. Only reported codec metadata is
  // varied; the patched installed codec remains untouched, and no loader is unblocked.
  return spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(import.meta.url)});
    const nextRequire = createRequire(require.resolve('next/package.json'));
    ${metadataOverride}
    await import(${JSON.stringify(script)});
  `], { encoding: 'utf8', timeout: 30000, windowsHide: true })
}

test('the image smoke accepts AVIF input only with the installed safe libheif', () => {
  const runtime = runRuntime()
  assert.equal(runtime.status, 0, runtime.stderr)
  const result = JSON.parse(runtime.stdout.trim())
  const { isAvifDecodeSafe } = nextRequire('next/dist/server/image-optimizer.js')
  assert.equal(result.avifInputBlocked, !isAvifDecodeSafe(result.heif))
  assert.equal(result.status, 'passed')
})

for (const heif of ['1.23.1', 'unknown', null]) {
  test(`the image smoke confirms Next rejects AVIF for unsafe codec metadata ${heif}`, () => {
    const runtime = runRuntime(heif)
    assert.equal(runtime.status, 0, runtime.stderr)
    const result = JSON.parse(runtime.stdout.trim())
    assert.equal(result.heif, heif)
    assert.equal(result.avifInputBlocked, true)
  })
}
