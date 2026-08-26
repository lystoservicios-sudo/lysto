import { CalendarClock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import type { CustomerEquipmentViewModel, CustomerUiTone } from '@/features/customer/view-models'
import { EquipmentThumbnail } from './equipment-thumbnail'

const dateFormatter = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
const badgeTones: Record<CustomerUiTone, 'blue' | 'green' | 'amber' | 'red' | 'slate'> = {
  brand: 'blue', success: 'green', warning: 'amber', danger: 'red', benefit: 'green', neutral: 'slate'
}

export function EquipmentHistoryCard({ equipment, compact = false }: { equipment: CustomerEquipmentViewModel; compact?: boolean }) {
  const nextMaintenance = equipment.nextMaintenanceAt ? dateFormatter.format(new Date(equipment.nextMaintenanceAt)) : 'Sin fecha programada'

  return (
    <article className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <EquipmentThumbnail imageUrl={equipment.imageUrl} imageAlt={equipment.imageAlt} equipmentName={equipment.nickname} size="sm" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-black text-slate-950">{equipment.nickname}</h3>
            {equipment.statusView ? <Badge tone={badgeTones[equipment.statusView.tone]}>{equipment.statusView.label}</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">{equipment.brand}{equipment.model ? ` · ${equipment.model}` : ''}</p>
          {!compact ? <p className="mt-1 text-xs text-slate-500">{equipment.kind} · {equipment.roomLabel ?? 'Ambiente no informado'}</p> : null}
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
