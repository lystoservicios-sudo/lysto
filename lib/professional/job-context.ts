import 'server-only'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
import { professionalJobContextSchema, type ProfessionalJobContext } from './job-context-contract'

/** The RPC resolves fresh session authority and assignment again in the database. */
export async function readProfessionalJobContext(session: Session, jobId: string): Promise<ProfessionalJobContext> {
  if (session.role !== 'professional' || !session.professionalId || session.professionalStatus !== 'approved' || !session.professionalEligible)
    throw new ApiError('forbidden')
  if (!z.string().uuid().safeParse(jobId).success) throw new ApiError('invalid_input')
  const { data, error } = await session.client.rpc('read_professional_job_context', { p_job_id: jobId })
  if (error) {
    if (error.code === '42501') throw new ApiError('forbidden')
    if (error.code === 'P0002') throw new ApiError('not_found')
    throw new ApiError('service_unavailable')
  }
  const parsed = professionalJobContextSchema.safeParse(data)
  if (!parsed.success || parsed.data.jobId !== jobId) throw new ApiError('service_unavailable')
  return parsed.data
}
