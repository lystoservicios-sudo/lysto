import 'server-only'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ApiError } from '@/lib/http/api-error'
import {
  onboardingInput,
  onboardingSchema,
  professionalReviewSchema,
  type ProfessionalReview
} from './onboarding-contracts'
import { getRegistrationPolicy } from '@/lib/auth/account-policy'
import { authOrigin } from '@/lib/auth/account-lifecycle'
import { dispatchProfessionalInvitation } from '@/lib/notifications/server'

export const invitationInput = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    specialtySlug: z.string().min(1).max(100),
    reason: z.string().trim().min(10).max(1000)
  })
  .strict()
export const invitationSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    specialtySlug: z.string(),
    status: z.enum(['queued', 'sent', 'opened', 'completed', 'expired', 'cancelled']),
    expiresAt: z.string().datetime({ offset: true }),
    createdAt: z.string().datetime({ offset: true }),
    version: z.number().int().positive()
  })
  .strict()
const createdInvitationSchema = invitationSchema.extend({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional()
})
const acceptedSchema = z
  .object({ professionalId: z.string().uuid(), status: z.literal('form_started') })
  .strict()
function fail(code: string): never {
  if (code === '42501') throw new ApiError('forbidden')
  if (code === 'P0002') throw new ApiError('not_found')
  if (code === 'P0001') throw new ApiError('feature_unavailable')
  if (['40001', '23505'].includes(code)) throw new ApiError('conflict')
  if (['22023', '22P02', '23514', '23502', '22007', '22008'].includes(code))
    throw new ApiError('invalid_input')
  throw new ApiError('service_unavailable')
}
export async function createProfessionalInvitation(session: Session, input: unknown) {
  if (
    session.role !== 'admin' ||
    session.assuranceLevel !== 'aal2' ||
    !session.permissions.some((permission) => permission === 'owner' || permission === 'operations')
  )
    throw new ApiError('forbidden')
  const data = invitationInput.parse(input)
  const result = await session.client.rpc('create_professional_invitation', {
    p_email: data.email,
    p_specialty_slug: data.specialtySlug,
    p_reason: data.reason
  })
  if (result.error) fail(result.error.code)
  const parsed = createdInvitationSchema.safeParse(result.data)
  if (!parsed.success) throw new ApiError('service_unavailable')
  const { token, ...invitation } = parsed.data
  const delivery = await dispatchProfessionalInvitation(invitation.id)
  return {
    invitation: delivery.accepted ? { ...invitation, status: 'sent' as const } : invitation,
    delivery,
    link: token ? `${authOrigin(process.env.NEXT_PUBLIC_APP_URL)}/pro/onboarding/${token}` : null
  }
}

export async function resendProfessionalInvitation(session: Session, input: unknown) {
  if (
    session.role !== 'admin' ||
    session.assuranceLevel !== 'aal2' ||
    !session.permissions.some((permission) => permission === 'owner' || permission === 'operations')
  )
    throw new ApiError('forbidden')
  const { invitationId } = z.object({ invitationId: z.string().uuid() }).strict().parse(input)
  return { delivery: await dispatchProfessionalInvitation(invitationId) }
}

/** This identity may have no domain profile yet. Only invitation/onboarding RPCs may use it. */
export async function onboardingIdentity() {
  const client = await createServerSupabaseClient()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new ApiError('unauthorized')
  if (!data.user.email_confirmed_at) throw new ApiError('forbidden')
  return client
}
export async function acceptProfessionalInvitation(input: unknown) {
  const data = z
    .object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
    .strict()
    .parse(input)
  const client = await onboardingIdentity()
  const result = await client.rpc('accept_professional_invitation', { p_token: data.token })
  if (result.error) fail(result.error.code)
  const parsed = acceptedSchema.safeParse(result.data)
  if (!parsed.success) throw new ApiError('service_unavailable')
  // Claiming a new invitation can assign the trusted professional role.
  // Refresh the signed claims before any domain operation uses the new identity.
  const refreshed = await client.auth.refreshSession()
  if (refreshed.error || !refreshed.data.session) throw new ApiError('session_unavailable')
  return parsed.data
}
export async function readProfessionalOnboarding() {
  const client = await onboardingIdentity()
  const result = await client.rpc('read_professional_onboarding')
  if (result.error) fail(result.error.code)
  const parsed = onboardingSchema.safeParse(result.data)
  if (!parsed.success) throw new ApiError('service_unavailable')
  return parsed.data
}
export async function saveProfessionalOnboarding(input: unknown) {
  const data = onboardingInput.parse(input)
  const client = await onboardingIdentity()
  const { expectedVersion, ...fields } = data
  const result = await client.rpc('save_professional_onboarding', {
    p_expected_version: expectedVersion,
    p_input: fields
  })
  if (result.error) fail(result.error.code)
  const parsed = onboardingSchema.safeParse(result.data)
  if (!parsed.success) throw new ApiError('service_unavailable')
  return parsed.data
}
export async function cancelProfessionalInvitation(session: Session, input: unknown) {
  if (
    session.role !== 'admin' ||
    session.assuranceLevel !== 'aal2' ||
    !session.permissions.some((permission) => permission === 'owner' || permission === 'operations')
  )
    throw new ApiError('forbidden')
  const data = z
    .object({
      invitationId: z.string().uuid(),
      expectedVersion: z.number().int().positive(),
      reason: z.string().trim().min(10).max(1000)
    })
    .strict()
    .parse(input)
  const result = await session.client.rpc('cancel_professional_invitation', {
    p_id: data.invitationId,
    p_expected_version: data.expectedVersion,
    p_reason: data.reason
  })
  if (result.error) fail(result.error.code)
  const parsed = invitationSchema.safeParse(result.data)
  if (!parsed.success) throw new ApiError('service_unavailable')
  return { invitation: parsed.data }
}

export async function readProfessionalReview(client: Session['client'], professionalId?: string) {
  const result = await client.rpc(
    'professional_review_context',
    professionalId ? { p_id: professionalId } : {}
  )
  if (result.error) fail(result.error.code)
  const parsed = professionalReviewSchema.safeParse(result.data)
  if (!parsed.success) throw new ApiError('service_unavailable')
  return parsed.data
}
function requireReviewPolicy(review: ProfessionalReview) {
  if (!review.requirements) throw new ApiError('feature_unavailable')
  if (
    review.requirements.testOnly &&
    (process.env.APP_ENV !== 'test' ||
      !['localhost', '127.0.0.1', '[::1]'].includes(
        new URL(authOrigin(process.env.NEXT_PUBLIC_APP_URL)).hostname
      ))
  )
    throw new ApiError('feature_unavailable')
}
export async function submitProfessionalApplication(input: unknown) {
  const data = z
    .object({
      expectedVersion: z.number().int().positive(),
      accepted: z.literal(true),
      termsVersion: z.string().min(1).max(100),
      privacyVersion: z.string().min(1).max(100)
    })
    .strict()
    .parse(input)
  const client = await onboardingIdentity()
  requireReviewPolicy(await readProfessionalReview(client))
  const legal = await getRegistrationPolicy()
  if (!legal) throw new ApiError('feature_unavailable')
  if (data.termsVersion !== legal.termsVersion || data.privacyVersion !== legal.privacyVersion)
    throw new ApiError('invalid_input')
  const result = await client.rpc('submit_professional_application', {
    p_expected_version: data.expectedVersion,
    p_terms_version: data.termsVersion,
    p_privacy_version: data.privacyVersion,
    p_accepted: data.accepted
  })
  if (result.error) fail(result.error.code)
  const parsed = onboardingSchema.safeParse(result.data)
  if (!parsed.success) throw new ApiError('service_unavailable')
  return parsed.data
}
const decisionInput = z
  .object({
    professionalId: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().trim().min(10).max(1000)
  })
  .strict()
function assertOperations(session: Session) {
  if (
    session.role !== 'admin' ||
    session.assuranceLevel !== 'aal2' ||
    !session.permissions.some((permission) => permission === 'owner' || permission === 'operations')
  )
    throw new ApiError('forbidden')
}
export async function decideProfessionalApplication(
  session: Session,
  input: unknown,
  approvalOnly = false
) {
  assertOperations(session)
  const data = (
    approvalOnly
      ? decisionInput.extend({ decision: z.literal('approved').default('approved') })
      : decisionInput
  ).parse(input)
  requireReviewPolicy(await readProfessionalReview(session.client, data.professionalId))
  const result = await session.client.rpc('decide_professional_application', {
    p_professional_id: data.professionalId,
    p_expected_version: data.expectedVersion,
    p_decision: data.decision,
    p_reason: data.reason
  })
  if (result.error) fail(result.error.code)
  const parsed = professionalReviewSchema.safeParse(result.data)
  if (!parsed.success) throw new ApiError('service_unavailable')
  return parsed.data
}
export async function reviewProfessionalDocument(session: Session, input: unknown) {
  assertOperations(session)
  const data = z
    .object({
      professionalId: z.string().uuid(),
      documentId: z.string().uuid(),
      expectedVersion: z.number().int().positive(),
      decision: z.enum(['approved', 'rejected']),
      reason: z.string().trim().min(10).max(1000),
      expiresAt: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
    })
    .strict()
    .parse(input)
  const review = await readProfessionalReview(session.client, data.professionalId)
  requireReviewPolicy(review)
  if (!review.documents.some((document) => document.id === data.documentId))
    throw new ApiError('not_found')
  const result = await session.client.rpc('review_professional_document', {
    p_document_id: data.documentId,
    p_expected_version: data.expectedVersion,
    p_decision: data.decision,
    p_reason: data.reason,
    p_expires_at: data.expiresAt!
  })
  if (result.error) fail(result.error.code)
  const parsed = professionalReviewSchema.safeParse(result.data)
  if (!parsed.success) throw new ApiError('service_unavailable')
  return parsed.data
}

export async function requestProfessionalRevalidation(session: Session, input: unknown) {
  assertOperations(session)
  const data = z.object({ professionalId: z.string().uuid(), expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(10).max(1000) }).strict().parse(input)
  const client = session.client as unknown as {
    rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }>
  }
  const result = await client.rpc('request_professional_revalidation', {
    p_professional_id: data.professionalId, p_expected_version: data.expectedVersion,
    p_reason: data.reason
  })
  if (result.error) fail(result.error.code ?? '')
  const parsed = professionalReviewSchema.safeParse(result.data)
  if (!parsed.success) throw new ApiError('service_unavailable')
  return parsed.data
}
