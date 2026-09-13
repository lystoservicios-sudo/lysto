import { getPricingSession, type PricingSession } from '@/lib/pricing/server'
import { paymentDatabase, type CheckoutRow } from './marketplace-db'

export async function approvedProfessional(session: PricingSession) {
  if (session.role !== 'professional') throw new Error('forbidden')
  const { data } = await session.client.from('professional_profiles').select('id,status').eq('profile_id',session.profileId).single()
  if (!data || data.status !== 'approved') throw new Error('forbidden')
  return data.id
}
export async function paymentActor() {
  const session = await getPricingSession()
  let professionalId: string | undefined
  if (session.role === 'professional') professionalId = await approvedProfessional(session)
  if (session.role === 'admin') {
    const permission = await paymentDatabase().query(`select 1 from private.admin_profile_permissions p join public.admin_profiles a on a.id=p.admin_profile_id where a.profile_id=$1 and p.permission in ('finance','owner')`,[session.profileId])
    if (!permission.rowCount) throw new Error('forbidden')
  }
  return { ...session, professionalId }
}
export type PaymentActor = Awaited<ReturnType<typeof paymentActor>>
export async function visibleCheckout(id: string, actor: PaymentActor) {
  const result = await paymentDatabase().query<CheckoutRow>('select * from public.marketplace_checkouts where id=$1', [id])
  const checkout = result.rows[0]
  if (!checkout || (actor.role !== 'admin' && checkout.customer_id !== actor.customerId && checkout.professional_id !== actor.professionalId)) throw new Error('payment_forbidden')
  return checkout
}
