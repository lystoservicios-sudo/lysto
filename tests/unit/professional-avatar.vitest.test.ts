// @vitest-environment node
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { expect, it } from 'vitest'
import { inspectProfessionalAvatar } from '@/lib/professional/avatar-service'

it('accepts only a small real image and publishes a metadata-free WebP derivative', async () => {
  const original = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#334455' } })
    .jpeg().withMetadata({ exif: { IFD0: { Copyright: 'private data' } } }).toBuffer()
  const result = await inspectProfessionalAvatar(new Uint8Array(original), 'image/jpeg')
  expect(result.bytes.length).toBeLessThan(2 * 1024 * 1024)
  expect(result.mimeType).toBe('image/webp')
  expect(result.sha256).toBe(createHash('sha256').update(result.bytes).digest('hex'))
  expect((await sharp(result.bytes).metadata()).exif).toBeUndefined()
})

it.each(['application/pdf', 'image/gif', 'image/png'])('rejects a false %s declaration', async mime => {
  await expect(inspectProfessionalAvatar(new Uint8Array([1, 2, 3]), mime)).rejects.toMatchObject({ code: 'invalid_input' })
})

it('rejects oversize input before decoding it', async () => {
  await expect(inspectProfessionalAvatar(new Uint8Array(2 * 1024 * 1024 + 1), 'image/jpeg')).rejects.toMatchObject({ code: 'invalid_input' })
})
