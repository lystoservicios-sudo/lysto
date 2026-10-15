import { notFound } from 'next/navigation'
import { requirePageSession } from '@/lib/auth/session'
import { readCustomerPaymentRecord } from '@/lib/customer-more/payments'
import { CustomerPaymentRecordView } from '@/components/customer/more-payments/payment-views'

export default async function CustomerPaymentRecordPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePageSession('customer')
  const { id } = await params
  const { checkoutId } = await searchParams
  if (typeof checkoutId !== 'string') notFound()
  const record = await readCustomerPaymentRecord(session, id, checkoutId)
  if (!record) notFound()
  return <CustomerPaymentRecordView record={record} />
}
