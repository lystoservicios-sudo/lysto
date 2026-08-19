import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StatusPill } from '@/components/business/status-pill'
import type { LystoJob } from '@/lib/mock/lysto-data'
import { nextJobActions } from '@/lib/jobs/workflow'

export function ProfessionalWorkbench({ job }: { job: LystoJob }) {
  const actions = nextJobActions(job.status)
  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Mesa de trabajo profesional</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">{job.issueLabel} · {job.customer}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{job.address} · {job.scheduledDate} · {job.timeWindow}</p>
        </div>
        <StatusPill status={job.status} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="bg-slate-50 shadow-none"><p className="text-sm font-bold text-slate-500">Diagnóstico preliminar</p><p className="mt-2 text-sm leading-6 text-slate-700">Revisar presión, filtros, unidad exterior, consumo eléctrico y estado de drenaje según síntoma.</p></Card>
        <Card className="bg-slate-50 shadow-none"><p className="text-sm font-bold text-slate-500">Checklist obligatorio</p><ul className="mt-2 list-inside list-disc text-sm leading-6 text-slate-700"><li>Fotos antes y después</li><li>Registrar equipo o confirmar equipo existente</li><li>Cargar diagnóstico real</li><li>Elegir mantenimiento recomendado</li></ul></Card>
      </div>
      <div>
        <p className="mb-2 text-sm font-bold text-slate-950">Acciones habilitadas por estado</p>
        <div className="flex flex-wrap gap-2">{actions.map((action) => <Button key={action.to} variant={action.danger ? 'danger' : 'secondary'}>{action.label}</Button>)}</div>
      </div>
    </Card>
  )
}
