import { CalendarClock, Camera, ChevronRight, MapPin } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import type { CustomerRequestViewModel, CustomerUiTone } from '@/features/customer/view-models'

const badgeTones: Record<CustomerUiTone, 'blue' | 'green' | 'amber' | 'red' | 'slate'> = {
  brand: 'blue',
  success: 'green',
  warning: 'amber',
  danger: 'red',
  benefit: 'green',
  neutral: 'slate'
}

const moneyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0
})

export function CustomerRequestSummaryCard({ request }: { request: CustomerRequestViewModel }) {
  return (
    <li>
      <Link
        href={`/app/solicitudes/${request.id}`}
        className="group block rounded-3xl border border-slate-200 bg-white p-5 transition-colors hover:border-blue-300 hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Solicitud {request.id.slice(0, 8)}
            </p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">
              {request.issueLabel}
            </h2>
          </div>
          <Badge tone={badgeTones[request.statusView.tone]}>{request.statusView.label}</Badge>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          <p className="flex min-w-0 items-start gap-2">
            <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{request.address}</span>
          </p>
          <p className="flex min-w-0 items-start gap-2">
            <CalendarClock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{request.preferredWindow}</span>
          </p>
          <p className="flex min-w-0 items-start gap-2">
            <Camera aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {request.mediaCount}{' '}
              {request.mediaCount === 1 ? 'archivo seleccionado' : 'archivos seleccionados'}
            </span>
          </p>
        </div>

        <div className="mt-5 flex items-end justify-between gap-4 border-t border-slate-100 pt-4">
          <div>
            <p className="text-xs font-semibold text-slate-500">Próximo paso</p>
            <p className="mt-1 text-sm font-bold text-slate-950">{request.nextStep}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {request.preliminaryPrice !== null ? (
              <span className="hidden font-black tabular-nums text-slate-950 sm:block">
                {moneyFormatter.format(request.preliminaryPrice)}
              </span>
            ) : null}
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-600 transition-colors group-hover:bg-blue-100 group-hover:text-blue-700">
              <ChevronRight aria-hidden="true" className="h-5 w-5" />
            </span>
          </div>
        </div>
      </Link>
    </li>
  )
}
