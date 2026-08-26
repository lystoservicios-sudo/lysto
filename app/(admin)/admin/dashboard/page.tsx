import { Users, Wrench, CreditCard, AlertTriangle, ChevronRight, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { adminMetrics, serviceRequests, jobs, professionals } from '@/lib/mock/lysto-data'

export default function AdminDashboardPage() {
  const pendingRequests = serviceRequests.filter(r => r.status === 'pending_assignment')
  const activeJobs = jobs.filter(j => ['technician_on_way', 'onsite_diagnosis', 'in_progress'].includes(j.status))
  const pendingProfessionals = professionals.filter(p => p.status === 'under_review')

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <span className="inline-flex items-center rounded-full bg-lysto-blueSoft px-3 py-1 text-xs font-bold text-lysto-blue">Admin</span>
        <h1 className="text-2xl font-black text-lysto-ink">Dashboard operativo</h1>
        <p className="text-sm text-lysto-muted">Centro de comando operativo: solicitudes, trabajos, profesionales y finanzas.</p>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {adminMetrics.map(metric => (
          <div key={metric.label} className={`rounded-2xl bg-white border p-4 shadow-[0_1px_3px_rgba(7,19,47,0.06)] ${
            metric.tone === 'red' ? 'border-red-100' : 'border-lysto-border'
          }`}>
            <p className="text-xs text-lysto-muted font-semibold">{metric.label}</p>
            <p className={`text-2xl font-black mt-1 ${
              metric.tone === 'blue' ? 'text-lysto-blue'
              : metric.tone === 'green' ? 'text-lysto-green'
              : metric.tone === 'red' ? 'text-red-600'
              : 'text-lysto-ink'
            }`}>{metric.value}</p>
            <p className="text-xs text-lysto-muted mt-0.5">{metric.helper}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: <Wrench className="h-5 w-5" />, label: 'Solicitudes', count: serviceRequests.length, href: '/admin/solicitudes', bg: 'bg-blue-50 text-blue-600', urgent: pendingRequests.length },
          { icon: <TrendingUp className="h-5 w-5" />, label: 'Matching', count: pendingRequests.length, href: '/admin/matching', bg: 'bg-amber-50 text-amber-600', urgent: pendingRequests.length },
          { icon: <Users className="h-5 w-5" />, label: 'Profesionales', count: professionals.length, href: '/admin/profesionales', bg: 'bg-green-50 text-green-600', urgent: pendingProfessionals.length },
          { icon: <CreditCard className="h-5 w-5" />, label: 'Pagos', count: 0, href: '/admin/pagos', bg: 'bg-purple-50 text-purple-600', urgent: 0 },
        ].map(item => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-3 rounded-2xl bg-white border border-lysto-border p-4 hover:bg-slate-50 transition-colors shadow-[0_1px_3px_rgba(7,19,47,0.04)]"
          >
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${item.bg}`}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-lysto-ink truncate">{item.label}</p>
              {item.urgent > 0 && (
                <p className="text-[10px] font-semibold text-red-600 truncate">{item.urgent} requieren acción</p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-lysto-muted shrink-0" />
          </Link>
        ))}
      </div>

      {/* Pending requests */}
      <div className="rounded-2xl bg-white border border-lysto-border shadow-[0_1px_3px_rgba(7,19,47,0.08)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-lysto-border">
          <h2 className="text-sm font-black text-lysto-ink">Solicitudes pendientes de asignación</h2>
          <Link href="/admin/solicitudes" className="text-xs font-semibold text-lysto-blue">Ver todas</Link>
        </div>
        <div className="divide-y divide-lysto-border">
          {serviceRequests.slice(0, 3).map(req => (
            <Link
              key={req.id}
              href={`/admin/solicitudes/${req.id}`}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors"
            >
              <div className="h-8 w-8 rounded-xl bg-lysto-blueSoft flex items-center justify-center text-sm">
                ❄️
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-lysto-ink truncate">{req.issueLabel} · {req.customer}</p>
                <p className="text-xs text-lysto-muted truncate">{req.address}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-lysto-ink">${(req.price / 1000).toFixed(0)}K</p>
                <p className="text-[10px] text-amber-600 font-semibold">{req.urgency}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Active jobs */}
      <div className="rounded-2xl bg-white border border-lysto-border shadow-[0_1px_3px_rgba(7,19,47,0.08)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-lysto-border">
          <h2 className="text-sm font-black text-lysto-ink">Trabajos activos</h2>
          <Link href="/admin/trabajos" className="text-xs font-semibold text-lysto-blue">Ver todos</Link>
        </div>
        <div className="divide-y divide-lysto-border">
          {jobs.slice(0, 3).map(job => (
            <Link
              key={job.id}
              href={`/admin/trabajos/${job.id}`}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors"
            >
              <div className="h-2 w-2 rounded-full bg-lysto-green shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-lysto-ink truncate">{job.customer} · {job.issueLabel}</p>
                <p className="text-xs text-lysto-muted truncate">{job.professional} · {job.timeWindow}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-lysto-muted shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
