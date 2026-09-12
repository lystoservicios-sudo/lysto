import { isAllowedAuthOrigin } from '@/lib/auth/account-lifecycle'
import { ApiError } from './api-error'

/** Check the origin and bound bytes actually read, including chunked requests. */
export async function readPrivateJsonBody(request: Request, maxBytes = 8192): Promise<unknown> {
  if (!isAllowedAuthOrigin(request.headers.get('origin'), process.env.NEXT_PUBLIC_APP_URL))
    throw new ApiError('forbidden')
  if (!/^application\/json$/i.test(request.headers.get('content-type')?.split(';')[0].trim() ?? ''))
    throw new ApiError('invalid_input')
  const reader = request.body?.getReader()
  if (!reader) throw new ApiError('invalid_input')
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new ApiError('invalid_input')
      }
      chunks.push(chunk.value)
    }
  } finally {
    reader.releaseLock()
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
