import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import {
  assignmentCandidatesQuery,
  listAssignableJobs,
  listAssignmentCandidates,
  listProfessionalOffers,
  mutateAssignment
} from '@/lib/admin/assignment-service'

export const GET = privateRoute({ roles: ['admin', 'professional'] }, async (request, session) => {
  const query = new URL(request.url).searchParams
  if (query.has('jobId'))
    return privateJson(await listAssignmentCandidates(session, assignmentCandidatesQuery(request)))
  return privateJson(
    session.role === 'admin'
      ? await listAssignableJobs(session)
      : await listProfessionalOffers(session)
  )
})

export const POST = privateRoute({ roles: ['admin', 'professional'] }, async (request, session) =>
  privateJson(await mutateAssignment(session, await readPrivateJsonBody(request)))
)
