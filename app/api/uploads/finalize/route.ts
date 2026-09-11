import { privateRoute } from '@/lib/http/route-handler'
import { privateJson } from '@/lib/http/api-error'
import { finalizeUpload, readUploadBody } from '@/lib/uploads/service'
export const runtime = 'nodejs'
export const POST = privateRoute({ roles: ['customer','professional'] }, async (request, session) => privateJson(await finalizeUpload(session, await readUploadBody(request))))
