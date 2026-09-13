import { notFound } from 'next/navigation'
import { JobQuotePanel } from '@/components/pricing/job-quote-panel'

import { CustomerJobDetail } from '@/components/customer/customer-job-detail'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'
import { findCustomerRecordById } from '@/features/customer/view-models'

export default async function CustomerJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return <JobQuotePanel jobId={id} />
  const job = findCustomerRecordById(customerDemoFixtures.jobs, id)
  if (!job) notFound()
  return <CustomerJobDetail job={job} />
}
