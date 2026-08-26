import { Clock, MapPin, ChevronRight, Star } from 'lucide-react'
import Link from 'next/link'
import { jobs, jobStatusLabels } from '@/lib/mock/lysto-data'

function money(value: number) {
  return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

const jobStatusColors: Record<string, string> = {
  technician_on_way: 'text-blue-700 bg-blue-50 border-blue-200',
  completed: 'text-slate-600 bg-slate-50 border-slate-200',
  completed_pending_customer_confirmation: 'text-amber-700 bg-amber-50 border-amber-200',
  in_progress: 'text-blue-700 bg-blue-50 border-blue-200',
}

export default function CustomerJobsPage() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <span className="inline-flex items-center rounded-full bg-lysto-blueSoft px-3 py-1 text-xs font-bold text-lysto-blue">Cliente</span>
        <h1 className="text-2xl font-black text-lysto-ink">Mis trabajos</h1>
        <p className="text-sm text-lysto-muted">Historial de servicios realizados y en curso.</p>
      </div>

      <div className="space-y-3">
        {jobs.map(job => {
          const statusLabel = jobStatusLabels[job.status as keyof typeof jobStatusLabels] ?? job.status
          const statusColor = jobStatusColors[job.status] ?? 'text-slate-600 bg-slate-50 border-slate-200'
          return (
            <Link
              key={job.id}
              href={`/app/trabajos/${job.id}`}
              className="block rounded-2xl bg-white border border-lysto-border p-4 hover:bg-slate-50 transition-colors shadow-[0_1px_3px_rgba(7,19,47,0.06)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusColor}`}>
                    {statusLabel}
                  </span>
                  <p className="font-black text-lysto-ink">{job.issueLabel}</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-lysto-muted">
                      <MapPin className="h-3 w-3" />{job.address}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-lysto-muted">
                      <Clock className="h-3 w-3" />{job.scheduledDate} · {job.timeWindow}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-black text-lysto-ink">{money(job.amount)}</p>
                    {job.status === 'completed' && (
                      <div className="flex items-center gap-1 text-lysto-warning">
                        {[1,2,3,4,5].map(i => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-lysto-muted shrink-0 mt-1" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
