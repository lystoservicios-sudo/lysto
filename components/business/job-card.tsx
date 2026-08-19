import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StatusTimeline } from '@/components/status/status-timeline'
import { StatusPill } from '@/components/business/status-pill'
import type { LystoJob } from '@/lib/mock/lysto-data'

const timeline = ['Confirmado', 'En camino', 'Llegó', 'Diagnóstico', 'Finalizado']
const currentByStatus: Record<string, number> = {
  confirmed: 0,
  technician_on_way: 1,
  arrived: 2,
  onsite_diagnosis: 3,
  waiting_customer_approval: 3,
  in_progress: 3,
  completed_pending_customer_confirmation: 4,
  completed: 4
}

export function JobCard({ job, href = `/app/trabajos/${job.id}` }: { job: LystoJob; href?: string }) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{job.id} · {job.scheduledDate} · {job.timeWindow}</p>
          <h3 className="mt-1 text-xl font-black text-slate-950">{job.issueLabel}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{job.customer} · {job.address}</p>
        </div>
        <StatusPill status={job.status} />
      </div>
      <StatusTimeline steps={timeline} current={currentByStatus[job.status] ?? 0} />
      <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
        <span><strong className="text-slate-950">Profesional:</strong> {job.professional}</span>
        <span><strong className="text-slate-950">Equipo:</strong> {job.equipment}</span>
        <span><strong className="text-slate-950">Pago:</strong> <StatusPill status={job.paymentStatus} /></span>
        <span><strong className="text-slate-950">Siguiente:</strong> {job.nextAction}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-2xl font-black text-slate-950">$ {job.amount.toLocaleString('es-AR')}</p>
        <ButtonLink href={href} variant="secondary">Abrir trabajo</ButtonLink>
      </div>
    </Card>
  )
}
