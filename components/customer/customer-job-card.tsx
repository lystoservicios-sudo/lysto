import { CalendarClock, MapPin, MonitorCog, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import type { CustomerJobViewModel, CustomerUiTone } from '@/features/customer/view-models'

const badgeTones: Record<CustomerUiTone, 'blue' | 'green' | 'amber' | 'red' | 'slate'> = {
  brand: 'blue',
  success: 'green',
  warning: 'amber',
  danger: 'red',
  benefit: 'green',
  neutral: 'slate'
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export function CustomerJobCard({ job }: { job: CustomerJobViewModel }) {
  const facts = [
    { icon: CalendarClock, label: 'Horario', value: `${dateFormatter.format(new Date(job.scheduledAt))} · ${job.timeWindow}` },
    { icon: UserRound, label: 'Profesional', value: job.professionalName ?? 'Asignación pendiente' },
    { icon: MonitorCog, label: 'Equipo', value: job.equipmentName ?? 'Equipo por confirmar' }
  ]

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{job.id}</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">{job.issueLabel}</h2>
        </div>
        <Badge tone={badgeTones[job.statusView.tone]}>{job.statusView.label}</Badge>
      </div>

      <div className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-600">
        <MapPin aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
        <span>{job.address}</span>
      </div>

      <dl className="mt-4 grid gap-px overflow-hidden rounded-2xl bg-slate-100 sm:grid-cols-3">
        {facts.map(({ icon: Icon, label, value }) => (
          <div key={label} className="min-w-0 bg-slate-50 p-3">
            <dt className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Icon aria-hidden="true" className="h-4 w-4" />{label}</dt>
            <dd className="mt-1 truncate text-sm font-bold text-slate-950">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-600"><strong className="text-slate-950">Próximo paso:</strong> {job.nextStep}</p>
        <ButtonLink href={`/app/trabajos/${job.id}`} variant="secondary" className="shrink-0">Ver seguimiento</ButtonLink>
      </div>
    </article>
  )
}
