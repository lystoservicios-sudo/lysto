import { MapPin, Clock, Search } from 'lucide-react'
import Link from 'next/link'
import { serviceRequests } from '@/lib/mock/lysto-data'

function money(value: number) {
  return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending_assignment: { label: 'Sin asignar', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  payment_approved: { label: 'Pago aprobado', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  pending_payment: { label: 'Sin pago', color: 'text-red-700 bg-red-50 border-red-200' },
}

export default function AdminRequestsPage() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <span className="inline-flex items-center rounded-full bg-lysto-blueSoft px-3 py-1 text-xs font-bold text-lysto-blue">Admin</span>
        <h1 className="text-2xl font-black text-lysto-ink">Solicitudes</h1>
        <p className="text-sm text-lysto-muted">Gestión y asignación de todas las solicitudes.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-lysto-muted" />
        <input
          type="search"
          placeholder="Buscar por cliente, dirección..."
          className="w-full rounded-xl border border-lysto-border bg-white pl-9 pr-4 py-2.5 text-sm text-lysto-ink placeholder:text-lysto-muted focus:outline-none focus:ring-2 focus:ring-lysto-blue/20 focus:border-lysto-blue"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {['Todas', 'Sin asignar', 'Pago aprobado', 'Sin pago'].map((tab, i) => (
          <button
            key={tab}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
              i === 0 ? 'bg-lysto-blue text-white' : 'bg-white border border-lysto-border text-lysto-muted hover:text-lysto-ink'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {serviceRequests.map(request => {
          const status = statusConfig[request.status] ?? { label: request.status, color: 'text-slate-600 bg-slate-50 border-slate-200' }
          return (
            <Link
              key={request.id}
              href={`/admin/solicitudes/${request.id}`}
              className="block rounded-2xl bg-white border border-lysto-border p-4 hover:bg-slate-50 transition-colors shadow-[0_1px_3px_rgba(7,19,47,0.06)]"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${status.color}`}>
                  {status.label}
                </span>
                <span className="text-xs text-lysto-muted">{request.createdAt}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="font-black text-lysto-ink">{request.issueLabel} · {request.customer}</p>
                  <div className="flex items-center gap-1.5 text-xs text-lysto-muted">
                    <MapPin className="h-3 w-3 shrink-0" />{request.address}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-lysto-muted">
                    <Clock className="h-3 w-3 shrink-0" />{request.timeWindow}
                  </div>
                  {request.assignedProfessional && (
                    <p className="text-xs font-semibold text-lysto-green">✓ {request.assignedProfessional}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-lysto-ink">{money(request.price)}</p>
                  <p className="text-[10px] font-bold text-lysto-muted uppercase">{request.urgency}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
