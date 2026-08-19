import { PageScaffold } from '@/components/layout/page-scaffold'
import { EquipmentCard } from '@/components/business/equipment-card'
import { equipment } from '@/lib/mock/lysto-data'

export default function CustomerEquipmentPage() {
  return <PageScaffold title="Mis equipos" eyebrow="Cliente" description="Historial técnico tipo historia clínica de cada aire acondicionado atendido por Lysto."><div className="grid gap-4 lg:grid-cols-2">{equipment.map((item) => <EquipmentCard key={item.id} item={item} href={`/app/equipos/${item.id}`} />)}</div></PageScaffold>
}
