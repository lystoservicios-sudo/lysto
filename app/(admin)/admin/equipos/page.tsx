import { PageScaffold } from '@/components/layout/page-scaffold'
import { EquipmentCard } from '@/components/business/equipment-card'
import { equipment } from '@/lib/mock/lysto-data'

export default function AdminEquipmentPage() {
  return <PageScaffold title="Equipos" eyebrow="Admin" description="Base técnica acumulada de equipos, historial y próximas oportunidades de mantenimiento."><div className="grid gap-4 lg:grid-cols-2">{equipment.map((item) => <EquipmentCard key={item.id} item={item} />)}</div></PageScaffold>
}
