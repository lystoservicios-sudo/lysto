import { CustomerPaymentsList } from '@/components/customer/more-payments/payment-views'
import { requirePageSession } from '@/lib/auth/session'
import { listCustomerPayments } from '@/lib/customer-more/payments'

export default async function CustomerPaymentsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePageSession('customer')
  return <CustomerPaymentsList data={await listCustomerPayments(session, await searchParams)} />
}
