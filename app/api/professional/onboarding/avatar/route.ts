import { ApiError, apiErrorResponse, privateJson } from '@/lib/http/api-error'
import { isAllowedAuthOrigin } from '@/lib/auth/account-lifecycle'
import { saveProfessionalAvatar } from '@/lib/professional/avatar-service'
import { RateLimitExceeded, rateLimitResponse } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    if (!isAllowedAuthOrigin(request.headers.get('origin'), process.env.NEXT_PUBLIC_APP_URL))
      throw new ApiError('forbidden')
    const mimeType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
    const reader = request.body?.getReader()
    if (!reader) throw new ApiError('invalid_input')
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      for (;;) {
        const next = await reader.read()
        if (next.done) break
        size += next.value.byteLength
        if (size > 2 * 1024 * 1024) {
          await reader.cancel()
          throw new ApiError('invalid_input')
        }
        chunks.push(next.value)
      }
    } finally {
      reader.releaseLock()
    }
    return privateJson(await saveProfessionalAvatar(new Uint8Array(Buffer.concat(chunks)), mimeType))
  } catch (error) {
    if (error instanceof RateLimitExceeded) return rateLimitResponse(error)
    return apiErrorResponse(error)
  }
}
