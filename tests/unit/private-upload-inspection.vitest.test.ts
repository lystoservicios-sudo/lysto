// @vitest-environment node
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { beforeAll, describe, expect, it } from 'vitest'
import { inspectUpload } from '@/lib/uploads/inspection'
import { validateUpload } from '@/lib/uploads/validation'

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
let png: Buffer
beforeAll(async () => { png = await sharp({ create: { width: 12, height: 8, channels: 3, background: '#23589a' } }).png().toBuffer() })
const expected = (bytes: Buffer, mimeType = 'image/png') => ({ mimeType, sizeBytes: bytes.length, sha256: digest(bytes), outputMimeType: 'image/webp' as const })

describe('verified private image content', () => {
  it('decodes and produces a separate safe image, stripping trailing content', async () => {
    const raw = Buffer.concat([png, Buffer.from('<script>untrusted attachment</script>')])
    const result = await inspectUpload(raw, expected(raw))
    expect(result.mimeType).toBe('image/webp')
    expect(result.width).toBe(12)
    expect(result.height).toBe(8)
    expect(result.sha256).toBe(digest(result.bytes))
    expect(result.bytes.includes(Buffer.from('<script>'))).toBe(false)
    expect((await sharp(result.bytes).metadata()).format).toBe('webp')
  })
  it('normalizes professional documents as JPEG', async () => {
    const result = await inspectUpload(png, { ...expected(png), outputMimeType: 'image/jpeg' })
    expect(result.mimeType).toBe('image/jpeg')
    expect((await sharp(result.bytes).metadata()).format).toBe('jpeg')
  })
  it('rejects a different hash', async () => { await expect(inspectUpload(png, { ...expected(png), sha256: 'a'.repeat(64) })).rejects.toThrow() })
  it('rejects a different byte length', async () => { await expect(inspectUpload(png, { ...expected(png), sizeBytes: png.length + 1 })).rejects.toThrow() })
  it('rejects a MIME header that disagrees with decoded bytes', async () => { await expect(inspectUpload(png, expected(png, 'image/jpeg'))).rejects.toThrow() })
  it.each(['image/svg+xml', 'application/pdf', 'video/mp4'])('blocks unsupported %s', async mime => {
    await expect(inspectUpload(png, expected(png, mime))).rejects.toThrow()
  })
  it('rejects arbitrary bytes with a photo MIME', async () => {
    const data = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    await expect(inspectUpload(data, expected(data))).rejects.toThrow()
  })
  it('rejects an incomplete image despite a valid header', async () => {
    const data = png.subarray(0, 40)
    await expect(inspectUpload(data, expected(data))).rejects.toThrow()
  })
  it('rejects decompression exceeding the pixel budget', async () => {
    const data = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: '#ffffff' } }).png().toBuffer()
    await expect(inspectUpload(data, expected(data))).rejects.toThrow()
  })
})

describe('upload input limits', () => {
  it.each([0, -1, NaN, Infinity, 1.2])('rejects a non-positive or non-integral size %s', sizeBytes => {
    expect(validateUpload({ kind: 'request-photo', mimeType: 'image/png', sizeBytes }).valid).toBe(false)
  })
  it.each(['request-video', 'professional-document', 'job-document'] as const)('does not accept uninspected video/PDF for %s', kind => {
    expect(validateUpload({ kind, mimeType: kind === 'request-video' ? 'video/mp4' : 'application/pdf', sizeBytes: 10 }).valid).toBe(false)
  })
  it('accepts a bounded WebP photo', () => { expect(validateUpload({ kind: 'request-photo', mimeType: 'image/webp', sizeBytes: 100 }).valid).toBe(true) })
})
