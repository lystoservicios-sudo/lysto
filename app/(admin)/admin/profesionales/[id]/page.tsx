import { notFound } from 'next/navigation'
import { professionals } from '@/lib/mock/lysto-data'
import { ProfessionalDetailPage } from '@/components/admin/admin-details'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const record = professionals.find(item => item.id === id)
  if (!record) notFound()
  return <ProfessionalDetailPage professional={record} />
}
