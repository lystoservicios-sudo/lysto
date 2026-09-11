import { notFound } from 'next/navigation'
import { jobs } from '@/lib/mock/lysto-data'
import { JobDetailPage } from '@/components/admin/admin-details'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const record = jobs.find(item => item.id === id)
  if (!record) notFound()
  return <JobDetailPage job={record} />
}
