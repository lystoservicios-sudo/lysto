import { CalendarDays, ClipboardCheck, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { CustomerEquipmentServiceViewModel } from '@/features/customer/view-models'
import { EmptyState } from './states'

const dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'UTC' })

export function ServiceHistoryList({ services }: { services: readonly CustomerEquipmentServiceViewModel[] }) {
  if (!services.length) return <EmptyState compact title="Todavía no hay servicios registrados" description="El historial se construirá cuando exista un cierre técnico confirmado para este equipo." />

  return (
    <ol className="divide-y divide-slate-100" aria-label="Historial de servicios del equipo">
      {services.map((service) => (
        <li key={service.id} className="py-4 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-black text-slate-950">{service.serviceType}</p>
              <time dateTime={service.performedAt} className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500"><CalendarDays aria-hidden="true" className="h-4 w-4" />{dateFormatter.format(new Date(service.performedAt))}</time>
            </div>
            {service.receiptAvailable ? <Badge tone="blue"><ClipboardCheck aria-hidden="true" className="mr-1 h-3.5 w-3.5" />Comprobante registrado</Badge> : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-700">{service.result}</p>
          {service.professionalName ? <p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><UserRound aria-hidden="true" className="h-4 w-4" />{service.professionalName}</p> : null}
        </li>
      ))}
    </ol>
  )
}
