import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StatusPill } from '@/components/business/status-pill'
import type { LystoProfessional } from '@/lib/mock/lysto-data'

export function ProfessionalCard({ professional, href = `/admin/profesionales/${professional.id}` }: { professional: LystoProfessional; href?: string }) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{professional.id} · score {professional.score}</p>
          <h3 className="mt-1 text-xl font-black text-slate-950">{professional.name}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{professional.specialty}</p>
        </div>
        <StatusPill status={professional.status} />
      </div>
      <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
        <span><strong className="text-slate-950">Zona:</strong> {professional.zone}</span>
        <span><strong className="text-slate-950">Rating:</strong> {professional.rating.toFixed(1)} · {professional.jobsCompleted} trabajos</span>
        <span><strong className="text-slate-950">Aceptación:</strong> {Math.round(professional.acceptanceRate * 100)}%</span>
        <span><strong className="text-slate-950">MP:</strong> {professional.mercadoPago === 'connected' ? 'Conectado' : professional.mercadoPago === 'pending' ? 'Pendiente' : 'Sin conectar'}</span>
      </div>
      <div className="flex flex-wrap gap-2">{professional.tools.slice(0, 4).map((tool) => <span key={tool} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{tool}</span>)}</div>
      <div className="flex justify-end border-t border-slate-100 pt-4"><ButtonLink href={href} variant="secondary">Ver perfil</ButtonLink></div>
    </Card>
  )
}
