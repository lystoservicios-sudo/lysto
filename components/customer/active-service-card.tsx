import { Clock3, MapPin, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import type { CustomerJobViewModel } from '@/features/customer/view-models'

const badgeTone = {
  brand: 'blue',
  success: 'green',
  warning: 'amber',
  danger: 'red',
  benefit: 'blue',
  neutral: 'slate'
} as const

export function TechnicianProfileCard({ name }: { name?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-slate-50 p-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-slate-700">
        <UserRound aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Profesional asignado</span>
        <span className="mt-0.5 block truncate font-black text-slate-950">{name ?? 'Asignación pendiente'}</span>
      </span>
    </div>
  )
}

export function TechnicianEtaCard({ scheduledAt, timeWindow }: { scheduledAt: string; timeWindow: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-blue-100 bg-blue-50 p-3" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-bold text-blue-900">
        <Clock3 aria-hidden="true" className="h-4 w-4" />
        Llegada estimada
      </div>
      <time dateTime={scheduledAt} className="mt-1 block text-xl font-black tabular-nums text-blue-950">{timeWindow}</time>
      <p className="mt-1 text-xs leading-5 text-blue-800">El rango se actualizará cuando exista información nueva.</p>
    </div>
  )
}

export function ActiveServiceCard({ job }: { job: CustomerJobViewModel }) {
  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Servicio activo</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{job.issueLabel}</h2>
        </div>
        <Badge tone={badgeTone[job.statusView.tone]}>{job.statusView.label}</Badge>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <TechnicianProfileCard name={job.professionalName} />
        <TechnicianEtaCard scheduledAt={job.scheduledAt} timeWindow={job.timeWindow} />
      </div>
      <div className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-600">
        <MapPin aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
        <span>{job.address}</span>
      </div>
      <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600"><strong className="text-slate-950">Próximo paso:</strong> {job.nextStep}</p>
        <ButtonLink href={`/app/trabajos/${job.id}`} variant="secondary">Seguir servicio</ButtonLink>
      </div>
    </article>
  )
}
