import 'server-only'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'

const uuid = z.string().uuid()
const date = z.string().date()
const instant = z.string().datetime({ offset: true })
const availabilityInputSchema = z.object({ professionalId: uuid, from: date, to: date }).strict()
const reservationSchema = z
  .object({
    id: uuid,
    jobId: uuid,
    version: z.number().int().positive(),
    startsAt: instant,
    endsAt: instant,
    localDate: date,
    state: z.enum(['hold', 'confirmed']),
    holdExpiresAt: instant.nullable()
  })
  .strict()
const availabilitySchema = z
  .object({
    timezone: z.literal('America/Argentina/Buenos_Aires'),
    settingsVersion: z.number().int().nonnegative(),
    windows: z.array(
      z
        .object({
          weekday: z.number().int().min(0).max(6),
          startTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
          endTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/)
        })
        .strict()
    ),
    absences: z.array(z.object({ startsAt: instant, endsAt: instant }).strict()),
    reservations: z.array(reservationSchema)
  })
  .strict()
const requestSchema = z
  .object({
    jobId: uuid,
    startsAt: instant,
    durationMinutes: z.number().int().min(30).max(480),
    travelBufferMinutes: z.number().int().min(0).max(180),
    reason: z.string().trim().min(15).max(1000),
    expectedVersion: z.number().int().nonnegative()
  })
  .strict()
const responseSchema = z
  .object({
    requestId: uuid,
    decision: z.enum(['approve', 'reject']),
    expectedVersion: z.number().int().nonnegative()
  })
  .strict()
const settingsSchema = z
  .object({
    professionalId: uuid,
    expectedVersion: z.number().int().nonnegative(),
    windows: z
      .array(
        z
          .object({
            weekday: z.number().int().min(0).max(6),
            startTime: z.string().regex(/^\d{2}:\d{2}$/),
            endTime: z.string().regex(/^\d{2}:\d{2}$/)
          })
          .strict()
      )
      .max(50),
    absences: z
      .array(
        z
          .object({
            startsAt: instant,
            endsAt: instant,
            reason: z.string().trim().min(5).max(500)
          })
          .strict()
      )
      .max(50)
  })
  .strict()
const requestResultSchema = z
  .object({
    id: uuid,
    status: z.literal('pending'),
    expectedVersion: z.number().int().nonnegative()
  })
  .strict()
const responseResultSchema = z
  .object({
    id: uuid,
    status: z.enum(['pending', 'approved', 'rejected']),
    scheduleVersion: z.number().int().positive().optional(),
    startsAt: instant.optional(),
    endsAt: instant.optional()
  })
  .strict()

export type ScheduleAvailability = z.infer<typeof availabilitySchema>

function databaseFailure(code?: string): never {
  if (code === '42501') throw new ApiError('forbidden')
  if (code === 'P0002') throw new ApiError('not_found')
  if (code === '40001' || code === '23P01' || code === '23505') throw new ApiError('conflict')
  if (code?.startsWith('22') || code === '23514') throw new ApiError('invalid_input')
  throw new ApiError('service_unavailable')
}

function parseRange(input: unknown) {
  const parsed = availabilityInputSchema.parse(input)
  const from = Date.parse(`${parsed.from}T00:00:00Z`)
  const to = Date.parse(`${parsed.to}T00:00:00Z`)
  if (to < from || to - from > 31 * 86_400_000) throw new ApiError('invalid_input')
  return parsed
}

function canReadProfessional(session: Session, professionalId: string) {
  if (session.role === 'professional') return session.professionalId === professionalId
  return (
    session.role === 'admin' &&
    session.assuranceLevel === 'aal2' &&
    session.permissions.some((permission) => permission === 'operations' || permission === 'owner')
  )
}

export async function getScheduleAvailability(session: Session, input: unknown) {
  const parsed = parseRange(input)
  if (!canReadProfessional(session, parsed.professionalId)) throw new ApiError('forbidden')
  const result = await session.client.rpc('get_schedule_availability', {
    p_professional_id: parsed.professionalId,
    p_from: parsed.from,
    p_to: parsed.to
  })
  if (result.error) databaseFailure(result.error.code)
  const value = availabilitySchema.safeParse(result.data)
  if (!value.success) throw new ApiError('service_unavailable')
  return value.data
}

export async function requestJobReschedule(session: Session, input: unknown) {
  if (!['customer', 'professional', 'admin'].includes(session.role)) throw new ApiError('forbidden')
  const parsed = requestSchema.parse(input)
  const result = await session.client.rpc('request_job_reschedule', {
    p_job_id: parsed.jobId,
    p_starts_at: parsed.startsAt,
    p_duration_minutes: parsed.durationMinutes,
    p_travel_buffer_minutes: parsed.travelBufferMinutes,
    p_reason: parsed.reason,
    p_expected_version: parsed.expectedVersion
  })
  if (result.error) databaseFailure(result.error.code)
  const value = requestResultSchema.safeParse(result.data)
  if (!value.success) throw new ApiError('service_unavailable')
  return { reschedule: value.data }
}

export async function respondJobReschedule(session: Session, input: unknown) {
  if (!['customer', 'professional'].includes(session.role)) throw new ApiError('forbidden')
  const parsed = responseSchema.parse(input)
  const result = await session.client.rpc('respond_job_reschedule', {
    p_request_id: parsed.requestId,
    p_decision: parsed.decision,
    p_expected_version: parsed.expectedVersion
  })
  if (result.error) databaseFailure(result.error.code)
  const value = responseResultSchema.safeParse(result.data)
  if (!value.success) throw new ApiError('service_unavailable')
  return { reschedule: value.data }
}

export async function replaceProfessionalScheduleSettings(session: Session, input: unknown) {
  const parsed = settingsSchema.parse(input)
  if (!canReadProfessional(session, parsed.professionalId)) throw new ApiError('forbidden')
  const result = await session.client.rpc('replace_professional_schedule_settings', {
    p_professional_id: parsed.professionalId,
    p_windows: parsed.windows,
    p_absences: parsed.absences,
    p_expected_version: parsed.expectedVersion
  })
  if (result.error) databaseFailure(result.error.code)
  const value = z
    .object({ professionalId: uuid, version: z.number().int().positive() })
    .strict()
    .safeParse(result.data)
  if (!value.success) throw new ApiError('service_unavailable')
  return { settings: value.data }
}

export function scheduleAvailabilityQuery(request: Request) {
  return availabilityInputSchema.parse(Object.fromEntries(new URL(request.url).searchParams))
}

export const rescheduleActionSchema = z.discriminatedUnion('action', [
  requestSchema.extend({ action: z.literal('request') }),
  responseSchema.extend({ action: z.literal('respond') })
])
