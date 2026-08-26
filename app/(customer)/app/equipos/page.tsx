import { CustomerEquipmentInventory } from '@/components/customer/customer-equipment-inventory'
import { PageScaffold } from '@/components/layout/page-scaffold'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'

export default function CustomerEquipmentPage() {
  return <PageScaffold title="Mis equipos" eyebrow="Cliente · Demostración" description="Identificá cada equipo, consultá su historial y revisá el próximo cuidado recomendado."><CustomerEquipmentInventory equipment={customerDemoFixtures.equipment} referenceDate="2026-08-25" /></PageScaffold>
}
