import { PageScaffold } from '@/components/layout/page-scaffold'
import { EquipmentCard } from '@/components/business/equipment-card'
import { Card } from '@/components/ui/card'
import { equipment } from '@/lib/mock/lysto-data'

export default function CustomerEquipmentDetailPage() {
  const item = equipment[0]
  return <PageScaffold title={item.nickname} eyebrow="Equipo" description="Ficha técnica, historial, mantenimiento recomendado y servicios relacionados."><div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]"><EquipmentCard item={item} /><Card><h2 className="text-xl font-black">Ficha técnica</h2><dl className="mt-4 grid gap-3 text-sm"><div><dt className="font-bold text-slate-950">Marca/modelo</dt><dd className="text-slate-600">{item.brand} {item.model}</dd></div><div><dt className="font-bold text-slate-950">Tipo</dt><dd className="text-slate-600">{item.type}</dd></div><div><dt className="font-bold text-slate-950">Dirección</dt><dd className="text-slate-600">{item.address}</dd></div></dl></Card></div></PageScaffold>
}
