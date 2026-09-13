import 'server-only'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError, apiErrorResponse, privateJson } from '@/lib/http/api-error'
import {
  signUpload,
  finalizeUpload,
  readUpload,
  readUploadBody,
  uploadDeclaration,
  uploadReference
} from '@/lib/uploads/service'
import { onboardingIdentity } from './onboarding-service'
import { onboardingSchema } from './onboarding-contracts'

async function requireDocumentSession(write: boolean): Promise<Session> {
  const client = await onboardingIdentity()
  const { data: identity, error: identityError } = await client.auth.getUser()
  if (identityError || !identity.user) throw new ApiError('unauthorized')
  const contextResult = await client.rpc('get_session_context')
  const context = z
    .object({
      profile_id: z.string().uuid(),
      professional_id: z.string().uuid(),
      role: z.literal('professional'),
      session_id: z.string().uuid(),
      session_active: z.literal(true),
      aal: z.enum(['aal1', 'aal2'])
    })
    .safeParse(contextResult.data)
  if (contextResult.error || !context.success) throw new ApiError('forbidden')
  const result = await client.rpc('read_professional_onboarding')
  const application = onboardingSchema.safeParse(result.data)
  if (
    result.error ||
    !application.success ||
    application.data.professionalId !== context.data.professional_id ||
    (write && !['form_started', 'rejected'].includes(application.data.status))
  )
    throw new ApiError('forbidden')
  return {
    client,
    userId: identity.user.id,
    profileId: context.data.profile_id,
    role: 'professional',
    professionalId: context.data.professional_id,
    professionalStatus: application.data.status,
    permissions: [],
    sessionId: context.data.session_id,
    assuranceLevel: context.data.aal
  }
}

/** Narrow alternative to the approved-professional upload routes: own application documents only. */
export function onboardingDocumentRoute(action: 'sign' | 'finalize' | 'read') {
  return async (request: Request) => {
    try {
      const session = await requireDocumentSession(action !== 'read')
      const input = await readUploadBody(request)
      if (action === 'sign') {
        const declaration = uploadDeclaration
          .extend({
            kind: z.literal('professional-document'),
            entityId: z.literal(session.professionalId!)
          })
          .strict()
          .parse(input)
        return privateJson(await signUpload(session, declaration))
      }
      const reference = uploadReference.parse(input)
      const result = await session.client.rpc('get_upload_intent', {
        p_intent_id: reference.intentId
      })
      const intent = z
        .object({
          kind: z.literal('professional-document'),
          entityId: z.literal(session.professionalId!),
          ownerProfileId: z.literal(session.profileId)
        })
        .safeParse(result.data)
      if (result.error || !intent.success) throw new ApiError('not_found')
      return privateJson(
        await (action === 'finalize'
          ? finalizeUpload(session, reference)
          : readUpload(session, reference))
      )
    } catch (error) {
      return apiErrorResponse(error)
    }
  }
}
