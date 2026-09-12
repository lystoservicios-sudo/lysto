import { getPricingSession, type PricingSession } from '@/lib/pricing/server'
import { requireAdminPermission } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
import { assertFinancialAssurance } from '@/lib/auth/admin-assurance'
import { paymentDatabase, type CheckoutRow } from './marketplace-db'

export async function approvedProfessional(session: PricingSession) {
  if (session.role !== 'professional') throw new Error('forbidden')
  const { data } = await session.client.from('professional_profiles').select('id,status').eq('profile_id',session.profileId).single()
  if (!data || data.status !== 'approved') throw new Error('forbidden')
  return data.id
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
