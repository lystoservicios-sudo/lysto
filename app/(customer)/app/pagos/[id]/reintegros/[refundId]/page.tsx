import { notFound } from 'next/navigation'
import { requirePageSession } from '@/lib/auth/session'
import { readCustomerRefund } from '@/lib/customer-more/payments'
import { CustomerRefundDetails } from '@/components/customer/more-payments/payment-views'

export default async function CustomerRefundPage({ params }: { params: Promise<{ id: string; refundId: string }> }) {
  const session = await requirePageSession('customer')
  const { id, refundId } = await params
  const data = await readCustomerRefund(session, id, refundId)
  if (!data) notFound()
  return <CustomerRefundDetails data={data} />
}
