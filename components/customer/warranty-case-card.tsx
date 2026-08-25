import { CalendarDays, ShieldCheck, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import type { CustomerUiTone, CustomerWarrantyViewModel } from '@/features/customer/view-models'
import { CaseStatusTimeline } from './case-status-timeline'

const badgeTones: Record<CustomerUiTone, 'blue' | 'green' | 'amber' | 'red' | 'slate'> = {
  brand: 'blue', success: 'green', warning: 'amber', danger: 'red', benefit: 'green', neutral: 'slate'
}
const dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'UTC' })

export function WarrantyCaseCard({ warranty }: { warranty: CustomerWarrantyViewModel }) {
  const isExpired = warranty.status === 'expired'
  const recordDate = warranty.status === 'claim_open' ? warranty.claimOpenedAt : warranty.completedAt
  const recordDateLabel = warranty.status === 'claim_open' ? 'Reclamo iniciado' : 'Servicio finalizado'
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{warranty.serviceLabel ?? 'Servicio con respaldo'}</p>
          <h3 className="mt-2 text-xl font-black text-slate-950">{warranty.equipmentName}</h3>
        </div>
        <Badge tone={badgeTones[warranty.statusView.tone]}>{warranty.statusView.label}</Badge>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-700">{warranty.safeSummary}</p>
      <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
        {warranty.professionalName ? <p className="flex items-center gap-2"><UserRound aria-hidden="true" className="h-4 w-4" />{warranty.professionalName}</p> : null}
        {recordDate ? <p className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="h-4 w-4" /><time dateTime={recordDate}>{recordDateLabel} {dateFormatter.format(new Date(recordDate))}</time></p> : null}
        {warranty.coverageEndsAt ? <p className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="h-4 w-4" />{isExpired ? 'Venció' : 'Cobertura hasta'} {dateFormatter.format(new Date(warranty.coverageEndsAt))}</p> : null}
      </div>
      {warranty.nextStep ? <div className="mt-4 rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Próximo paso</p><p className="mt-1 text-sm font-semibold leading-6 text-slate-800">{warranty.nextStep}</p></div> : null}
      {warranty.timeline?.length ? <div className="mt-5 border-t border-slate-100 pt-5"><CaseStatusTimeline equipmentName={warranty.equipmentName} steps={warranty.timeline} /></div> : null}
      {warranty.status === 'active' ? <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-700"><ShieldCheck aria-hidden="true" className="h-4 w-4" />Cobertura vinculada al cierre técnico</p> : null}
      <ButtonLink href={`/app/trabajos/${warranty.jobId}`} variant="secondary" size="sm" className="mt-5 w-full sm:w-auto">Ver detalle del servicio</ButtonLink>
    </article>
  )
}
