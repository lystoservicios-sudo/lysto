import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MAINTENANCE_OPTIONS } from '@/lib/domain/constants'
import type { LystoEquipment } from '@/lib/mock/lysto-data'

export function EquipmentCard({ item, href = `/app/equipos/${item.id}` }: { item: LystoEquipment; href?: string }) {
  return (
    <Card className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.id} · {item.customer}</p>
        <h3 className="mt-1 text-xl font-black text-slate-950">{item.nickname}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{item.brand} {item.model} · {item.type}</p>
      </div>
      <div className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
        <strong>Mantenimiento recomendado:</strong> {MAINTENANCE_OPTIONS[item.maintenanceOption]} · próximo {item.nextMaintenance}
      </div>
      <div className="space-y-2">{item.history.map((record) => <div key={`${item.id}-${record.date}-${record.title}`} className="rounded-2xl bg-slate-50 p-3"><p className="text-sm font-black text-slate-950">{record.date} · {record.title}</p><p className="mt-1 text-sm text-slate-600">{record.detail}</p></div>)}</div>
      <div className="flex justify-end border-t border-slate-100 pt-4"><ButtonLink href={href} variant="secondary">Ver historial</ButtonLink></div>
    </Card>
  )
}
