import { notFound } from 'next/navigation'
import { requirePageSession } from '@/lib/auth/session'
import { readCustomerPaymentDetail } from '@/lib/customer-more/payments'
import { CustomerPaymentDetails } from '@/components/customer/more-payments/payment-views'

export default async function CustomerPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePageSession('customer')
  const { id } = await params
  const detail = await readCustomerPaymentDetail(session, id)
  if (!detail) notFound()
  return <CustomerPaymentDetails detail={detail} customerId={session.customerId!} />
}
