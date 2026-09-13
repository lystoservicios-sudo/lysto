import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { persistReview } from '@/lib/reviews/review-service'

export const POST = privateRoute({ roles: ['customer'] }, async (request, session) =>
  privateJson({ review: await persistReview(session, await readPrivateJsonBody(request, 8192)) })
)
