import 'server-only'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'

const uuid = z.string().uuid()
const instant = z.string().datetime({ offset: true })
const scheduleSchema = z.object({
  startsAt: instant,
  durationMinutes: z.number().int().min(30).max(480),
  travelBufferMinutes: z.number().int().min(0).max(180)
})
const candidateSchema = z
  .object({
    id: uuid,
    firstName: z.string(),
    lastName: z.string(),
    ratingAvg: z.number().nullable(),
    jobsCompleted: z.number().int().nonnegative(),
    acceptanceRate: z.number().min(0).max(1),
    internalScore: z.number(),
    paymentAccountConnected: z.boolean()
  })
  .strict()
const createdOfferSchema = z
  .object({
    id: uuid,
    jobId: uuid,
    professionalId: uuid,
    version: z.number().int().positive(),
    status: z.literal('pending'),
    expiresAt: instant,
    scheduleVersion: z.number().int().positive(),
    paymentAccountConnected: z.boolean()
  })
  .strict()
const respondedOfferSchema = z
  .object({
    id: uuid,
    jobId: uuid,
    status: z.enum(['accepted', 'rejected', 'expired']),
    assignmentVersion: z.number().int().positive(),
    paymentAccountConnected: z.boolean().optional(),
    paymentStatus: z.enum(['pending', 'approved']).optional()
  })
  .strict()
const createSchema = scheduleSchema
  .extend({
    action: z.literal('assign'),
    jobId: uuid,
    professionalId: uuid,
    expiresAt: instant,
    expectedVersion: z.number().int().nonnegative()
  })
  .strict()
const respondSchema = z
  .object({
    action: z.literal('respond'),
    offerId: uuid,
    response: z.enum(['accepted', 'rejected']),
    reason: z.string().trim().min(10).max(1000).optional(),
    expectedVersion: z.number().int().positive()
  })
  .strict()
  .superRefine((input, context) => {
    if (input.response === 'rejected' && !input.reason)
      context.addIssue({ code: 'custom', message: 'Rejection reason required' })
  })
export const assignmentActionSchema = z.union([createSchema, respondSchema])

function databaseFailure(code?: string): never {
  if (code === '42501') throw new ApiError('forbidden')
  if (code === 'P0002') throw new ApiError('not_found')
  if (code === '40001' || code === '23P01' || code === '23505') throw new ApiError('conflict')
  if (code?.startsWith('22') || code === '23514') throw new ApiError('invalid_input')
  throw new ApiError('service_unavailable')
}

function requireOperations(session: Session) {
  if (
    session.role !== 'admin' ||
    session.assuranceLevel !== 'aal2' ||
    !session.permissions.some((permission) => permission === 'operations' || permission === 'owner')
  )
    throw new ApiError('forbidden')
}

export async function listAssignableJobs(session: Session) {
  requireOperations(session)
  const result = await session.client
    .from('jobs')
    .select('id,request_id,status,scheduled_date,scheduled_time_window,assignment_version')
    .eq('status', 'pending_assignment')
    .order('created_at', { ascending: true })
    .limit(100)
  if (result.error) databaseFailure(result.error.code)
  return { jobs: result.data ?? [], role: session.role }
}

export async function listProfessionalOffers(session: Session) {
  if (session.role !== 'professional' || !session.professionalId) throw new ApiError('forbidden')
  const result = await session.client
    .from('assignment_offers')
    .select('id,job_id,status,expires_at,version,rejection_reason')
    .eq('professional_id', session.professionalId)
    .in('status', ['pending', 'accepted'])
    .order('expires_at', { ascending: true })
    .limit(100)
  if (result.error) databaseFailure(result.error.code)
  return { offers: result.data ?? [], role: session.role }
}

export async function listAssignmentCandidates(session: Session, input: unknown) {
  requireOperations(session)
  const value = scheduleSchema.extend({ jobId: uuid }).strict().parse(input)
  const result = await session.client.rpc('list_assignment_candidates', {
    p_job_id: value.jobId,
    p_starts_at: value.startsAt,
    p_duration_minutes: value.durationMinutes,
    p_travel_buffer_minutes: value.travelBufferMinutes
  })
  if (result.error) databaseFailure(result.error.code)
  const candidates = z.array(candidateSchema).safeParse(result.data)
  if (!candidates.success) throw new ApiError('service_unavailable')
  return { candidates: candidates.data }
}

export async function mutateAssignment(session: Session, input: unknown) {
  const value = assignmentActionSchema.parse(input)
  if (value.action === 'assign') {
    requireOperations(session)
    const result = await session.client.rpc('create_assignment_offer', {
      p_job_id: value.jobId,
      p_professional_id: value.professionalId,
      p_starts_at: value.startsAt,
      p_duration_minutes: value.durationMinutes,
      p_travel_buffer_minutes: value.travelBufferMinutes,
      p_expires_at: value.expiresAt,
      p_expected_version: value.expectedVersion
    })
    if (result.error) databaseFailure(result.error.code)
    const offer = createdOfferSchema.safeParse(result.data)
    if (!offer.success) throw new ApiError('service_unavailable')
    return { offer: offer.data }
  }
  if (session.role !== 'professional') throw new ApiError('forbidden')
  const result = await session.client.rpc('respond_assignment_offer', {
    p_offer_id: value.offerId,
    p_response: value.response,
    p_reason: value.reason ?? null,
    p_expected_version: value.expectedVersion
  })
  if (result.error) databaseFailure(result.error.code)
  const offer = respondedOfferSchema.safeParse(result.data)
  if (!offer.success) throw new ApiError('service_unavailable')
  return { offer: offer.data }
}

export function assignmentCandidatesQuery(request: Request) {
  return z
    .object({
      jobId: uuid,
      startsAt: instant,
      durationMinutes: z.coerce.number().int().min(30).max(480),
      travelBufferMinutes: z.coerce.number().int().min(0).max(180)
    })
    .strict()
    .parse(Object.fromEntries(new URL(request.url).searchParams))
}
