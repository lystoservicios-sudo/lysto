import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

export function authorizeOutboxWorker(
  header: string | null,
  secret: string | undefined,
  enabled: boolean
): boolean {
  if (
    !enabled ||
    !secret ||
    !/^[A-Za-z0-9_-]{32,128}$/.test(secret) ||
    !header ||
    header.length > 256
  )
    return false
  const expected = Buffer.from(`Bearer ${secret}`),
    actual = Buffer.from(header)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
export async function readOutboxBody(request: Request) {
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    throw new Error('invalid_worker_body')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('invalid_worker_body')
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('worker_body_timeout')), 3000)
  })
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), timeout])
      if (chunk.done) break
      length += chunk.value.byteLength
      if (length > 1024) throw new Error('worker_body_too_large')
      chunks.push(chunk.value)
    }
    return z
      .object({ batchSize: z.number().int().min(1).max(5).default(5) })
      .strict()
      .parse(JSON.parse(Buffer.concat(chunks).toString('utf8')))
  } finally {
    clearTimeout(timer)
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
