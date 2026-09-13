import { privateRoute } from '@/lib/http/route-handler'
import { privateJson } from '@/lib/http/api-error'
import { readUpload, readUploadBody } from '@/lib/uploads/service'
export const runtime = 'nodejs'
export const POST = privateRoute({}, async (request, session) => privateJson(await readUpload(session, await readUploadBody(request))))
