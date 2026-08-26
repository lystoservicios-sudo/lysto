import { Wrench, Calendar, ShieldCheck, Star, ChevronRight, MapPin, Package, PlusCircle } from 'lucide-react'
import Link from 'next/link'
import { jobs, equipment, customerMetrics } from '@/lib/mock/lysto-data'

export default function CustomerDashboardPage() {
  const activeJob = jobs.find(j => j.status === 'technician_on_way')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-lysto-blueSoft px-3 py-1 text-xs font-bold text-lysto-blue">Mi cuenta</span>
        <h1 className="text-2xl font-black tracking-tight text-lysto-ink">¡Hola! 👋</h1>
        <p className="text-sm text-lysto-muted">Tu plataforma de servicios de aire acondicionado.</p>
      </div>

      {/* Active job card */}
      {activeJob && (
        <div className="rounded-2xl bg-lysto-blue text-white p-4 space-y-3 shadow-[0_4px_16px_rgba(0,123,255,0.25)]">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-black">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              EN CAMINO
            </span>
            <span className="text-sm font-semibold opacity-80">{activeJob.timeWindow}</span>
          </div>
          <div>
            <p className="font-black text-lg">{activeJob.issueLabel}</p>
            <div className="flex items-center gap-1.5 mt-1 text-white/80 text-sm">
              <MapPin className="h-3.5 w-3.5" />
              {activeJob.address}
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-[10px] opacity-70">Profesional</p>
              <p className="text-sm font-bold">{activeJob.professional}</p>
            </div>
            <Link
              href={`/app/trabajos/${activeJob.id}`}
              className="inline-flex items-center gap-1 rounded-xl bg-white text-lysto-blue px-4 py-2 text-sm font-bold hover:bg-blue-50 transition-colors"
            >
              Seguir <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/app/solicitar/aire-acondicionado" className="flex items-center gap-3 rounded-2xl bg-lysto-blue text-white p-4 hover:bg-lysto-blueDark transition-colors shadow-[0_2px_8px_rgba(0,123,255,0.2)]">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
            <PlusCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs opacity-80">Nuevo</p>
            <p className="font-bold text-sm">Solicitar servicio</p>
          </div>
        </Link>
        <Link href="/app/trabajos" className="flex items-center gap-3 rounded-2xl bg-white border border-lysto-border p-4 hover:bg-slate-50 transition-colors shadow-[0_1px_3px_rgba(7,19,47,0.06)]">
          <div className="h-10 w-10 rounded-xl bg-lysto-blueSoft flex items-center justify-center">
            <Wrench className="h-5 w-5 text-lysto-blue" />
          </div>
          <div>
            <p className="text-xs text-lysto-muted">Historial</p>
            <p className="font-bold text-sm text-lysto-ink">Mis trabajos</p>
          </div>
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        {customerMetrics.map(metric => (
          <div key={metric.label} className="rounded-2xl bg-white border border-lysto-border p-4 shadow-[0_1px_3px_rgba(7,19,47,0.06)]">
            <p className="text-xs text-lysto-muted font-semibold">{metric.label}</p>
            <p className={`text-2xl font-black mt-1 ${
              metric.tone === 'blue' ? 'text-lysto-blue'
              : metric.tone === 'green' ? 'text-lysto-green'
              : metric.tone === 'amber' ? 'text-lysto-warning'
              : 'text-lysto-ink'
            }`}>{metric.value}</p>
            <p className="text-xs text-lysto-muted mt-0.5">{metric.helper}</p>
          </div>
        ))}
      </div>

      {/* My equipment */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black text-lysto-ink">Mis equipos</h2>
          <Link href="/app/equipos" className="text-xs font-semibold text-lysto-blue">Ver todos →</Link>
        </div>
        <div className="space-y-2">
          {equipment.slice(0, 2).map(eq => (
            <Link
              key={eq.id}
              href={`/app/equipos/${eq.id}`}
              className="flex items-center gap-3 rounded-2xl bg-white border border-lysto-border p-4 hover:bg-slate-50 transition-colors shadow-[0_1px_3px_rgba(7,19,47,0.04)]"
            >
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl shrink-0">❄️</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lysto-ink text-sm">{eq.nickname}</p>
                <p className="text-xs text-lysto-muted">{eq.brand} {eq.model?.slice(0, 10)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-lysto-muted">Próx. mant.</p>
                <p className="text-xs font-semibold text-lysto-ink">{eq.nextMaintenance}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: <Calendar className="h-5 w-5" />, label: 'Mantenimientos', href: '/app/mantenimientos', bg: 'bg-amber-50 text-amber-600' },
          { icon: <ShieldCheck className="h-5 w-5" />, label: 'Garantías', href: '/app/garantias', bg: 'bg-green-50 text-green-600' },
          { icon: <Package className="h-5 w-5" />, label: 'Pagos', href: '/app/pagos', bg: 'bg-purple-50 text-purple-600' },
          { icon: <Star className="h-5 w-5" />, label: 'Mi perfil', href: '/app/perfil', bg: 'bg-slate-50 text-slate-600' },
        ].map(item => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-3 rounded-2xl bg-white border border-lysto-border p-3.5 hover:bg-slate-50 transition-colors"
          >
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${item.bg}`}>
              {item.icon}
            </div>
            <span className="text-sm font-semibold text-lysto-ink">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
