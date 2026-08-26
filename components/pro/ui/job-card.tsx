import { Clock, MapPin, Wrench, DollarSign, Navigation, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { StatusBadge } from './status-badge'
import type { JobRecord } from '@/lib/mock/lysto-data'

function money(value: number) {
  return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function getCtaLabel(status: string): string {
  const labels: Record<string, string> = {
    technician_on_way: 'Confirmar llegada',
    confirmed: 'Confirmar llegada',
    arrived: 'Iniciar diagnóstico',
    onsite_diagnosis: 'Completar diagnóstico',
    waiting_customer_approval: 'Ver aprobación',
    in_progress: 'Registrar cierre',
    completed_pending_customer_confirmation: 'Ver detalles',
  }
  return labels[status] ?? 'Ver detalles'
}

export function JobCard({ job }: { job: JobRecord }) {
  const isActive = !['completed', 'cancelled_by_customer', 'cancelled_by_professional', 'cancelled_by_admin'].includes(job.status)
  const ctaLabel = getCtaLabel(job.status)

  return (
    <div className="rounded-3xl bg-white border border-slate-200/90 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.07)] transition-all duration-200 space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4">
        <StatusBadge status={job.status} />
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100/80 px-3 py-1 rounded-full">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          <span>{job.timeWindow}</span>
        </div>
      </div>

      {/* Customer Info */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl bg-blue-600 text-white text-base font-black flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
          {getInitials(job.customer)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black text-slate-900 leading-snug tracking-tight">{job.customer}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-blue-600" />{job.address}</span>
            <span>·</span>
            <span>{job.issueLabel}</span>
          </div>
        </div>
      </div>

      {/* Grid Specs */}
      <div className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <Wrench className="h-3.5 w-3.5 text-blue-600" />
            <span>Equipo</span>
          </div>
          <p className="text-xs font-black text-slate-900 truncate">{job.equipment?.split(' ').slice(0, 3).join(' ')}</p>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <DollarSign className="h-3.5 w-3.5 text-blue-600" />
            <span>Valor est.</span>
          </div>
          <p className="text-xs font-black text-slate-900">{money(job.amount)}</p>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <Navigation className="h-3.5 w-3.5 text-blue-600" />
            <span>Distancia</span>
          </div>
          <p className="text-xs font-black text-slate-900">~15 min</p>
        </div>
      </div>

      {/* Footer Step + Action */}
      <div className="flex items-center justify-between gap-4 pt-1">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Próximo paso</p>
          <p className="text-xs font-bold text-slate-600 truncate mt-0.5">{job.nextStep}</p>
        </div>

        {isActive && (
          <Link
            href={`/pro/trabajos/${job.id}`}
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-5 py-2.5 text-xs font-black hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-md shadow-blue-600/20"
          >
            {ctaLabel}
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  )
}
