import { z } from 'zod'
import { ApiError, privateJson } from '@/lib/http/api-error'
import { privateRoute } from '@/lib/http/route-handler'
import { readProfessionalJobContext } from '@/lib/professional/job-context'

export const GET = privateRoute({ roles: ['professional'] }, async (request, session) => {
  const params = new URL(request.url).searchParams
  if ([...params.keys()].some(key => key !== 'jobId') || params.getAll('jobId').length !== 1)
    throw new ApiError('invalid_input')
  const jobId = z.string().uuid().parse(params.get('jobId'))
  return privateJson({ context: await readProfessionalJobContext(session, jobId) })
})
