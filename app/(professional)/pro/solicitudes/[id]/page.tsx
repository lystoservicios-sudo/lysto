import { notFound } from 'next/navigation'
import { ProfessionalRequestDetail } from '@/components/pro/pro-details'
import { visibleRequests } from '@/components/pro/pro-model'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const request = visibleRequests.find(record => record.id === id)
  if (!request) notFound()
  return <ProfessionalRequestDetail key={request.id} request={request} />
}
