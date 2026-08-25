import { notFound } from 'next/navigation'

import { CustomerEquipmentDetail } from '@/components/customer/customer-equipment-detail'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'
import { findCustomerRecordById } from '@/features/customer/view-models'

export default async function CustomerEquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const equipment = findCustomerRecordById(customerDemoFixtures.equipment, id)
  if (!equipment) notFound()

  const warranty = customerDemoFixtures.warranties.find((item) => item.equipmentId === equipment.id)
  const maintenance = customerDemoFixtures.maintenance.find((item) => item.equipmentId === equipment.id)
  return <CustomerEquipmentDetail equipment={equipment} warranty={warranty} maintenance={maintenance} />
}
