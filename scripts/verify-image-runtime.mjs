import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const nextRequire = createRequire(require.resolve('next/package.json'))
const { getSharp, optimizeImage, isAvifDecodeSafe, canDecodeAvif } = require('next/dist/server/image-optimizer.js')
const sharp = getSharp(1)
const sharpVersion = sharp.versions.sharp
assert.equal(sharpVersion, '0.35.5', 'Next must resolve the reviewed patched image processor')
assert.equal(nextRequire('postcss/package.json').version, '8.5.26')

const source = await sharp({ create: { width: 32, height: 32, channels: 3, background: { r: 30, g: 80, b: 140 } } }).png().toBuffer()
const formats = ['image/jpeg', 'image/png', 'image/webp']
for (const contentType of formats) {
  const output = await optimizeImage({ buffer: source, contentType, quality: 75, width: 16, concurrency: 1, timeoutInSeconds: 10 })
  const metadata = await sharp(output).metadata()
  assert.equal(metadata.width, 16)
  assert.equal(metadata.height, 16)
  const decoded = await sharp(output).raw().toBuffer({ resolveWithObject: true })
  assert.equal(decoded.info.width, 16)
  assert.equal(decoded.info.height, 16)
}
// Next 15.5.27 permits AVIF decoding only with patched libheif >=1.23.2.
// Verify its runtime gate; never unblock a loader to make this smoke pass.
// Primary source: https://github.com/vercel/next.js/blob/v15.5.27/packages/next/src/server/image-optimizer.ts
for (const unsafeVersion of [null, 'unknown', '1.22.0', '1.23.1']) {
  assert.equal(isAvifDecodeSafe(unsafeVersion), false, 'Unknown or vulnerable AVIF decoders must remain blocked')
}
for (const safeVersion of ['1.23.2', '1.23.3', '1.24.0', '2.0.0']) {
  assert.equal(isAvifDecodeSafe(safeVersion), true)
}
const heifVersion = sharp.versions.heif ?? null
const avifDecodeSafe = isAvifDecodeSafe(heifVersion)
assert.equal(canDecodeAvif(1), avifDecodeSafe)
const avif = await optimizeImage({ buffer: source, contentType: 'image/avif', quality: 75, width: 16, concurrency: 1 })
assert.ok(avif.length > 0)
if (avifDecodeSafe) {
  const decoded = await optimizeImage({ buffer: avif, contentType: 'image/webp', quality: 75, width: 16, concurrency: 1 })
  const metadata = await sharp(decoded).metadata()
  assert.equal(metadata.width, 16)
  assert.equal(metadata.height, 16)
  assert.equal(metadata.format, 'webp')
} else {
  await assert.rejects(
    optimizeImage({ buffer: avif, contentType: 'image/webp', quality: 75, width: 16, concurrency: 1 }),
    /unsupported image format/
  )
}
console.log(JSON.stringify({ status: 'passed', platform: process.platform, sharp: sharpVersion, heif: heifVersion, postcss: nextRequire('postcss/package.json').version, nextOptimizerFormats: formats, avifInputBlocked: !avifDecodeSafe }))
