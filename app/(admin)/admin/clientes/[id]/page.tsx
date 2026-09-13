import { notFound } from 'next/navigation'
import { customers } from '@/lib/mock/lysto-data'
import { CustomerDetailPage } from '@/components/admin/admin-details'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const record = customers.find(item => item.id === id)
  if (!record) notFound()
  return <CustomerDetailPage customer={record} />
}
