import { CalendarClock, CircleCheck, MapPin, ShieldAlert, ShieldCheck, ShieldX, Snowflake } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { CustomerEquipmentViewModel, CustomerMaintenanceViewModel, CustomerUiTone, CustomerWarrantyViewModel } from '@/features/customer/view-models'
import { cn } from '@/lib/utils/cn'
import { EquipmentThumbnail } from './equipment-thumbnail'
import { InfoNotice } from './info-notice'
import { MaintenanceReminderCard } from './maintenance-reminder-card'
import { ServiceHistoryList } from './service-history-list'

const badgeTones: Record<CustomerUiTone, 'blue' | 'green' | 'amber' | 'red' | 'slate'> = {
  brand: 'blue', success: 'green', warning: 'amber', danger: 'red', benefit: 'green', neutral: 'slate'
}
const dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'UTC' })
const warrantyToneStyles: Record<CustomerUiTone, { panel: string; icon: string; eyebrow: string; body: string }> = {
  brand: { panel: 'border-blue-200 bg-blue-50 text-blue-950', icon: 'text-blue-700', eyebrow: 'text-blue-700', body: 'text-blue-900/80' },
  success: { panel: 'border-emerald-200 bg-emerald-50 text-emerald-950', icon: 'text-emerald-700', eyebrow: 'text-emerald-700', body: 'text-emerald-900/80' },
  warning: { panel: 'border-amber-200 bg-amber-50 text-amber-950', icon: 'text-amber-700', eyebrow: 'text-amber-700', body: 'text-amber-900/80' },
  danger: { panel: 'border-red-200 bg-red-50 text-red-950', icon: 'text-red-700', eyebrow: 'text-red-700', body: 'text-red-900/80' },
  benefit: { panel: 'border-emerald-200 bg-emerald-50 text-emerald-950', icon: 'text-emerald-700', eyebrow: 'text-emerald-700', body: 'text-emerald-900/80' },
  neutral: { panel: 'border-slate-200 bg-slate-50 text-slate-950', icon: 'text-slate-600', eyebrow: 'text-slate-600', body: 'text-slate-700' }
}
const warrantyIcons = {
  active: ShieldCheck,
  claim_open: ShieldAlert,
  resolved: CircleCheck,
  rejected: ShieldX,
  expired: ShieldX
} satisfies Record<CustomerWarrantyViewModel['status'], typeof ShieldCheck>

export function CustomerEquipmentDetail({ equipment, warranty, maintenance }: {
  equipment: CustomerEquipmentViewModel
  warranty?: CustomerWarrantyViewModel
  maintenance?: CustomerMaintenanceViewModel
}) {
  const technicalFacts = [
    { label: 'Marca', value: equipment.brand || 'Marca no informada' },
    { label: 'Modelo', value: equipment.model || 'Modelo no informado' },
    { label: 'Tipo', value: equipment.kind || 'Tipo no informado' },
    { label: 'Capacidad', value: equipment.capacityLabel || 'Capacidad no informada' },
    { label: 'Ambiente', value: equipment.roomLabel || 'Ambiente no informado' },
    { label: 'Número de serie', value: equipment.serialNumber || 'Serie no informada' }
  ]
  const warrantyStyle = warranty ? warrantyToneStyles[warranty.statusView.tone] : null
  const WarrantyIcon = warranty ? warrantyIcons[warranty.status] : ShieldCheck

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden p-0 shadow-none">
        <div className="grid gap-5 bg-blue-50/60 p-5 sm:p-6 md:grid-cols-[15rem_minmax(0,1fr)] md:items-center">
          <EquipmentThumbnail imageUrl={equipment.imageUrl} imageAlt={equipment.imageAlt} equipmentName={equipment.nickname} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">{equipment.id} · Demostración</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{equipment.nickname}</h1>
              </div>
              {equipment.statusView ? <Badge tone={badgeTones[equipment.statusView.tone]}>{equipment.statusView.label}</Badge> : null}
            </div>
            <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-700"><MapPin aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />{equipment.address}</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><Snowflake aria-hidden="true" className="h-4 w-4" />{equipment.brand}{equipment.model ? ` · ${equipment.model}` : ''}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="min-w-0 space-y-5">
          <Card className="shadow-none">
            <h2 className="text-xl font-black text-slate-950">Ficha técnica</h2>
            <dl className="mt-4 grid gap-px overflow-hidden rounded-2xl bg-slate-100 sm:grid-cols-2">
              {technicalFacts.map((fact) => <div key={fact.label} className="bg-slate-50 p-3"><dt className="text-xs font-semibold text-slate-500">{fact.label}</dt><dd className="mt-1 text-sm font-bold text-slate-950">{fact.value}</dd></div>)}
            </dl>
            {equipment.installedAt ? <p className="mt-4 flex items-center gap-2 text-sm text-slate-600"><CalendarClock aria-hidden="true" className="h-4 w-4" />Instalado el {dateFormatter.format(new Date(equipment.installedAt))}</p> : null}
          </Card>

          <Card className="shadow-none">
            <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Ficha de vida</p><h2 className="mt-1 text-xl font-black text-slate-950">Historial de servicios</h2></div>
            <ServiceHistoryList services={equipment.serviceHistory ?? []} />
          </Card>
        </div>

        <aside className="min-w-0 space-y-4" aria-label="Garantía y mantenimiento del equipo">
          {warranty ? (
            <div className={cn('rounded-3xl border p-5', warrantyStyle?.panel)}>
              <WarrantyIcon aria-hidden="true" className={cn('h-6 w-6', warrantyStyle?.icon)} />
              <p className={cn('mt-3 text-xs font-bold uppercase tracking-[0.12em]', warrantyStyle?.eyebrow)}>Garantía</p>
              <h2 className="mt-1 text-lg font-black">{warranty.statusView.label}</h2>
              <p className={cn('mt-2 text-sm leading-6', warrantyStyle?.body)}>{warranty.safeSummary}</p>
              {warranty.coverageEndsAt ? <p className="mt-3 text-xs font-semibold">{warranty.status === 'expired' ? 'Venció' : 'Hasta'} {dateFormatter.format(new Date(warranty.coverageEndsAt))}</p> : null}
            </div>
          ) : <InfoNotice tone="info" title="Sin garantía vinculada" description="No hay una cobertura confirmada asociada a este equipo." />}
          {maintenance ? <MaintenanceReminderCard reminder={maintenance} /> : <InfoNotice tone="info" title="Sin próxima recomendación" description="El último parte no definió un mantenimiento futuro para este equipo." />}
        </aside>
      </div>
    </div>
  )
}
