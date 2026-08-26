import { notFound } from 'next/navigation'

import { CustomerJobDetail } from '@/components/customer/customer-job-detail'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'
import { findCustomerRecordById } from '@/features/customer/view-models'

export default async function CustomerJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = findCustomerRecordById(customerDemoFixtures.jobs, id)
  if (!job) notFound()
  return <CustomerJobDetail job={job} />
}
