import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const nextRequire = createRequire(require.resolve('next/package.json'))
const { getSharp, optimizeImage } = require('next/dist/server/image-optimizer.js')
const sharp = getSharp(1)
const sharpVersion = sharp.versions.sharp
assert.equal(sharpVersion, '0.35.4', 'Next must resolve the reviewed patched image processor')
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
// Next 15.5.24 deliberately blocks AVIF input loaders as part of its security
// patch. Preserve this restriction; do not unblock Sharp to make a smoke pass.
const avif = await optimizeImage({ buffer: source, contentType: 'image/avif', quality: 75, width: 16, concurrency: 1 })
assert.ok(avif.length > 0)
await assert.rejects(
  optimizeImage({ buffer: avif, contentType: 'image/webp', quality: 75, width: 16, concurrency: 1 }),
  /unsupported image format/
)
console.log(JSON.stringify({ status: 'passed', platform: process.platform, sharp: sharpVersion, postcss: nextRequire('postcss/package.json').version, nextOptimizerFormats: formats, avifInputBlocked: true }))
