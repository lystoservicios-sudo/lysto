import { notFound } from 'next/navigation'
import { JobQuotePanel } from '@/components/pricing/job-quote-panel'

import { CustomerRequestDetail } from '@/components/customer/customer-request-detail'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'
import { findCustomerRecordById } from '@/features/customer/view-models'

export default async function CustomerRequestDetailPage({ params }: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return <JobQuotePanel requestId={id} />
  const request = findCustomerRecordById(customerDemoFixtures.requests, id)

  if (!request) notFound()

  return <CustomerRequestDetail request={request} />
}
