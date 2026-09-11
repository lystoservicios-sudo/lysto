import 'server-only'
import { createHash } from 'node:crypto'
import sharp from 'sharp'

export type InspectionExpectation = { mimeType: string; sizeBytes: number; sha256: string; outputMimeType: 'image/jpeg' | 'image/webp' }
const formats: Readonly<Record<string, string>> = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }
const options = { failOn: 'warning' as const, limitInputPixels: 20_000_000, limitInputChannels: 4, sequentialRead: true }
export class UploadInspectionError extends Error {
  constructor() { super('El contenido del archivo no coincide con una imagen admitida.'); this.name = 'UploadInspectionError' }
}

/** Only a freshly decoded, metadata-free derivative is eligible for attachment. */
export async function inspectUpload(raw: Uint8Array, expected: InspectionExpectation): Promise<{ bytes: Buffer; mimeType: string; sha256: string; width: number; height: number }> {
  try {
    if (!Number.isSafeInteger(expected.sizeBytes) || expected.sizeBytes < 1 || expected.sizeBytes > 20 * 1024 * 1024 || raw.byteLength !== expected.sizeBytes) throw new UploadInspectionError()
    if (!Object.hasOwn(formats, expected.mimeType) || !['image/jpeg', 'image/webp'].includes(expected.outputMimeType)) throw new UploadInspectionError()
    if (!/^[a-f0-9]{64}$/.test(expected.sha256) || createHash('sha256').update(raw).digest('hex') !== expected.sha256) throw new UploadInspectionError()
    const source = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength)
    const signatureMatches = expected.mimeType === 'image/png'
      ? source.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : expected.mimeType === 'image/jpeg'
        ? source.length >= 3 && source[0] === 255 && source[1] === 216 && source[2] === 255
        : source.length >= 12 && source.toString('ascii',0,4) === 'RIFF' && source.toString('ascii',8,12) === 'WEBP'
    if (!signatureMatches) throw new UploadInspectionError()
    const metadata = await sharp(source, options).metadata()
    if (metadata.format !== formats[expected.mimeType] || !metadata.width || !metadata.height || metadata.width * metadata.height > options.limitInputPixels || (metadata.pages ?? 1) !== 1) throw new UploadInspectionError()
    const pipeline = sharp(source, options).autoOrient().timeout({ seconds: 10 })
    // No keepMetadata()/withMetadata(): Sharp strips EXIF, embedded profiles and comments.
    const result = await (expected.outputMimeType === 'image/jpeg' ? pipeline.jpeg({ quality: 90 }) : pipeline.webp({ quality: 90 })).toBuffer({ resolveWithObject: true })
    if (result.data.length < 1 || result.data.length > 20 * 1024 * 1024) throw new UploadInspectionError()
    return { bytes: result.data, mimeType: expected.outputMimeType, sha256: createHash('sha256').update(result.data).digest('hex'), width: result.info.width, height: result.info.height }
  } catch { throw new UploadInspectionError() }
}
