import { Clock, MapPin, Calendar, X, Eye, CheckCircle2, Timer, ClipboardList, Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { ServiceRequestRecord } from '@/lib/mock/lysto-data'

function money(value: number) {
  return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

const issueIcons: Record<string, string> = {
  no_enfria: '❄️',
  pierde_agua: '💧',
  hace_ruido: '🔊',
  no_enciende: '⚡',
  instalacion: '🔧',
  mantenimiento: '🔩',
  calor: '🌡️',
}

export function RequestCard({ request }: { request: ServiceRequestRecord }) {
  const issueIcon = issueIcons[request.issue] ?? '🔧'
  const isCompatible = request.urgency === 'priority'

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-[0_2px_8px_rgba(15,23,42,0.06)] overflow-hidden transition-shadow hover:shadow-[0_4px_14px_rgba(15,23,42,0.09)]">
      {/* Top Status bar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <span className="rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-extrabold px-3 py-0.5">
            Esperando tu respuesta
          </span>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
            <Timer className="h-3.5 w-3.5 text-blue-600" />
            <span>Respuesta en {request.urgency === 'priority' ? '2h 15m' : '1h 40m'}</span>
          </div>
        </div>
        {isCompatible && (
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-0.5 rounded-full flex items-center gap-1">
            Compatible con tu perfil ✓
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Issue + customer + estimated income */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="h-12 w-12 rounded-2xl bg-blue-50/80 border border-blue-100 flex items-center justify-center text-2xl shrink-0">
              {issueIcon}
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-lg leading-tight tracking-tight">
                {request.issueLabel} <span className="font-semibold text-slate-500">· {request.customer}</span>
              </h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-blue-600" />{request.address}</span>
                <span className="text-slate-400">|</span>
                <span>12 min (4,2 km)</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-blue-600" />Hoy · {request.timeWindow}</span>
                <span className="text-slate-400">|</span>
                <span>Split living · Surrey inverter</span>
              </div>
            </div>
          </div>

          <div className="shrink-0 text-right bg-slate-50 border border-slate-200/80 px-4 py-3 rounded-2xl">
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Ingreso estimado</p>
            <p className="text-2xl font-black text-slate-900 leading-tight mt-0.5">{money(request.price)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Incluye visita y mano de obra</p>
          </div>
        </div>

        {/* Clean Neutral Diagnosis preview block */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 flex flex-col sm:flex-row items-start justify-between gap-3">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <div className="h-6 w-6 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <ClipboardList className="h-3.5 w-3.5" />
              </div>
              <span>Diagnóstico preliminar LYSTO</span>
              <Info className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed mt-1">{request.diagnosis}.</p>
            <p className="text-[10px] text-slate-400 mt-0.5">El diagnóstico definitivo se realiza al revisar el equipo.</p>
          </div>

          {/* Photo thumbnails */}
          {request.mediaCount > 0 && (
            <div className="flex items-center gap-2 shrink-0 self-center sm:self-start pt-1 sm:pt-0">
              <div className="h-12 w-12 rounded-xl bg-slate-200 border border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-inner">
                Foto 1
              </div>
              <div className="h-12 w-12 rounded-xl bg-slate-200 border border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-inner">
                Foto 2
              </div>
              <div className="h-12 w-12 rounded-xl bg-white border border-slate-300 flex items-center justify-center text-xs font-black text-slate-700 shadow-sm">
                +{request.mediaCount} fotos
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-1">
          <button className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white py-3 px-5 text-sm font-black hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm">
            <CheckCircle2 className="h-4.5 w-4.5" />
            Aceptar trabajo
          </button>
          <button className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 text-slate-800 bg-white py-3 px-5 text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm">
            <Eye className="h-4.5 w-4.5 text-slate-500" />
            Ver detalles
          </button>
          <button className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-500 py-3 px-4 text-sm font-bold hover:bg-slate-50 hover:text-slate-700 transition-colors">
            <X className="h-4 w-4" />
            No tomar
          </button>
        </div>
      </div>
    </div>
  )
}
