import { privateRoute } from '@/lib/http/route-handler'
import { ApiError, privateJson } from '@/lib/http/api-error'
import { readUploadBody, signUpload } from '@/lib/uploads/service'
export const runtime = 'nodejs'
export const POST = privateRoute({ roles: ['customer','professional'] }, async (request, session) => {
  const expected = request.headers.get('X-Lysto-Customer-Id')
  if (expected !== null && expected !== session.customerId) throw new ApiError('forbidden')
  return privateJson(await signUpload(session, await readUploadBody(request)))
})
