import { notFound } from 'next/navigation'

import { CustomerRequestDetail } from '@/components/customer/customer-request-detail'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'
import { findCustomerRecordById } from '@/features/customer/view-models'

export default async function CustomerRequestDetailPage({ params }: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const request = findCustomerRecordById(customerDemoFixtures.requests, id)

  if (!request) notFound()

  return <CustomerRequestDetail request={request} />
}
