import { AirVent, CalendarClock } from 'lucide-react'

import { ButtonLink } from '@/components/ui/button'
import type { CustomerEquipmentViewModel } from '@/features/customer/view-models'

const dateFormatter = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })

export function EquipmentHistoryCard({ equipment, compact = false }: { equipment: CustomerEquipmentViewModel; compact?: boolean }) {
  const nextMaintenance = equipment.nextMaintenanceAt ? dateFormatter.format(new Date(equipment.nextMaintenanceAt)) : 'Sin fecha programada'

  return (
    <article className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
          <AirVent aria-hidden="true" className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-black text-slate-950">{equipment.nickname}</h3>
          <p className="mt-1 text-sm text-slate-600">{equipment.brand}{equipment.model ? ` · ${equipment.model}` : ''}</p>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
        <CalendarClock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <span><strong className="text-slate-950">Próximo mantenimiento:</strong> {nextMaintenance}</span>
      </div>
      {!compact ? <p className="mt-3 text-sm text-slate-600">{equipment.serviceCount} servicios registrados</p> : null}
      <div className="mt-auto pt-4"><ButtonLink href={`/app/equipos/${equipment.id}`} variant="ghost" className="w-full">Ver equipo</ButtonLink></div>
    </article>
  )
}
