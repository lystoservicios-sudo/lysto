import { z } from 'zod'
import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { mutateExtra } from '@/lib/jobs/onsite-service'

export const GET = privateRoute(
  { roles: ['professional', 'customer', 'admin'] },
  async (request, session) => {
    const jobId = z.string().uuid().parse(new URL(request.url).searchParams.get('jobId'))
    const result = await session.client
      .from('job_extras')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at')
    if (result.error) throw new Error('extras_unavailable')
    return privateJson({ extras: result.data ?? [] })
  }
)
export const POST = privateRoute({ roles: ['professional'] }, async (request, session) =>
  privateJson({ extra: await mutateExtra(session, await readPrivateJsonBody(request)) })
)
export const PATCH = privateRoute({ roles: ['customer'] }, async (request, session) =>
  privateJson({ extra: await mutateExtra(session, await readPrivateJsonBody(request)) })
)
