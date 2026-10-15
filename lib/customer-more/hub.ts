import 'server-only'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
import { readCustomerProfile } from '@/lib/customer-assets/service'
import { countPendingCustomerPayments } from './payments'

export async function readCustomerMore(session: Session) {
  if (session.role !== 'customer' || !session.customerId) throw new ApiError('forbidden')
  const profile = await readCustomerProfile(session)
  const [payments, replies] = await Promise.allSettled([
    countPendingCustomerPayments(session),
    session.client.from('complaints').select('id', { head: true, count: 'exact' })
      .eq('customer_id', session.customerId).eq('status', 'waiting_customer')
  ])
  return {
    profile,
    pendingPayments: payments.status === 'fulfilled' ? payments.value : null,
    awaitingReplies: replies.status === 'fulfilled' && !replies.value.error ? replies.value.count : null
  }
}
