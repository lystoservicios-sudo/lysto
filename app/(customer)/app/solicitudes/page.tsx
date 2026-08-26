import { Clock, MapPin, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { serviceRequests } from '@/lib/mock/lysto-data'

function money(value: number) {
  return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending_assignment: { label: 'Buscando profesional', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  payment_approved: { label: 'Pago aprobado', color: 'text-green-700 bg-green-50 border-green-200' },
  pending_payment: { label: 'Pendiente de pago', color: 'text-red-700 bg-red-50 border-red-200' },
  confirmed: { label: 'Profesional asignado', color: 'text-blue-700 bg-blue-50 border-blue-200' },
}

export default function CustomerRequestsPage() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <span className="inline-flex items-center rounded-full bg-lysto-blueSoft px-3 py-1 text-xs font-bold text-lysto-blue">Cliente</span>
        <h1 className="text-2xl font-black text-lysto-ink">Mis solicitudes</h1>
        <p className="text-sm text-lysto-muted">Seguí el estado de cada pedido de servicio.</p>
      </div>

      <div className="space-y-3">
        {serviceRequests.map(request => {
          const status = statusConfig[request.status] ?? { label: request.status, color: 'text-slate-600 bg-slate-50 border-slate-200' }
          return (
            <Link
              key={request.id}
              href={`/app/solicitudes/${request.id}`}
              className="block rounded-2xl bg-white border border-lysto-border p-4 hover:bg-slate-50 transition-colors shadow-[0_1px_3px_rgba(7,19,47,0.06)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${status.color}`}>
                    {status.label}
                  </span>
                  <p className="font-black text-lysto-ink">{request.issueLabel}</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-lysto-muted">
                      <MapPin className="h-3 w-3" />{request.address}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-lysto-muted">
                      <Clock className="h-3 w-3" />{request.timeWindow}
                    </div>
                  </div>
                  <p className="text-lg font-black text-lysto-blue">{money(request.price)}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-lysto-muted shrink-0 mt-1" />
              </div>
            </Link>
          )
        })}
      </div>

      <Link
        href="/app/solicitar/aire-acondicionado"
        className="flex items-center justify-center gap-2 w-full rounded-2xl bg-lysto-blue text-white py-3.5 text-sm font-bold hover:bg-lysto-blueDark transition-colors"
      >
        + Solicitar nuevo servicio
      </Link>
    </div>
  )
}
