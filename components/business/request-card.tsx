import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StatusPill } from '@/components/business/status-pill'
import type { LystoRequest } from '@/lib/mock/lysto-data'

export function RequestCard({ request, href = `/admin/solicitudes/${request.id}` }: { request: LystoRequest; href?: string }) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{request.id} · {request.createdAt}</p>
          <h3 className="mt-1 text-xl font-black text-slate-950">{request.issueLabel}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{request.customer} · {request.address}</p>
        </div>
        <StatusPill status={request.status} />
      </div>
      <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        {request.diagnosis}
      </div>
      <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
        <span><strong className="text-slate-950">Horario:</strong> {request.timeWindow}</span>
        <span><strong className="text-slate-950">Plan:</strong> {request.selectedOption === 'priority' ? 'Prioridad' : 'Flexible'}</span>
        <span><strong className="text-slate-950">Media:</strong> {request.mediaCount} archivos</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-2xl font-black text-slate-950">$ {request.amount.toLocaleString('es-AR')}</p>
        <ButtonLink href={href} variant="secondary">Ver detalle</ButtonLink>
      </div>
    </Card>
  )
}
