import { getPricingSession, type PricingSession } from '@/lib/pricing/server'
import { requireAdminPermission, requireSession } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
import { assertFinancialAssurance } from '@/lib/auth/admin-assurance'
import { paymentDatabase, type CheckoutRow } from './marketplace-db'
import { onboardingIdentity, readProfessionalOnboarding } from '@/lib/professional/onboarding-service'

export async function approvedProfessional(session: PricingSession) {
  if (session.role !== 'professional') throw new Error('forbidden')
  const { data } = await session.client.from('professional_profiles').select('id,status').eq('profile_id',session.profileId).single()
  if (!data || data.status !== 'approved') throw new Error('forbidden')
  return data.id
}
/** Only seller account/OAuth endpoints may use this narrower onboarding identity. */
export async function onboardingMarketplaceProfessional() {
  const client = await onboardingIdentity()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user?.id) throw new ApiError('unauthorized')
  try {
    const application = await readProfessionalOnboarding()
    if (!['form_started', 'rejected', 'form_submitted', 'under_review', 'approved'].includes(application.status))
      throw new ApiError('forbidden')
    return { userId: data.user.id, professionalId: application.professionalId, status: application.status }
  } catch (failure) {
    if (!(failure instanceof ApiError) || !['forbidden', 'not_found'].includes(failure.code)) throw failure
    // Keep the original, approved-only account access for pre-invitation profiles.
    const session = await requireSession()
    if (session.role !== 'professional' || session.userId !== data.user.id ||
      session.professionalStatus !== 'approved' || !session.professionalId) throw new ApiError('forbidden')
    return { userId: session.userId, professionalId: session.professionalId, status: 'approved' }
  }
}
export async function paymentActor() {
  const session = await getPricingSession()
  assertFinancialAssurance(session)
  let professionalId: string | undefined
  if (session.role === 'professional') professionalId = await approvedProfessional(session)
  if (session.role === 'admin') {
    await requireAdminPermission('finance', session)
  }
  return { ...session, professionalId }
}
export type PaymentActor = Awaited<ReturnType<typeof paymentActor>>
export async function visibleCheckout(id: string, actor: PaymentActor) {
  const result = await paymentDatabase().query<CheckoutRow>('select * from public.marketplace_checkouts where id=$1', [id])
  const checkout = result.rows[0]
  if (!checkout || (actor.role !== 'admin' && checkout.customer_id !== actor.customerId && checkout.professional_id !== actor.professionalId)) throw new ApiError('not_found')
  return checkout
}
