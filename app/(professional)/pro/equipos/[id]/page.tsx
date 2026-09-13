import { notFound } from 'next/navigation'
import { ProfessionalEquipmentDetail } from '@/components/pro/pro-details'
import { professionalEquipment } from '@/components/pro/pro-model'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const item = professionalEquipment.find(record => record.id === id)
  if (!item) notFound()
  return <ProfessionalEquipmentDetail item={item} />
}
