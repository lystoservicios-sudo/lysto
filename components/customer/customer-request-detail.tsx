import { CalendarClock, Camera, MapPin } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { CustomerRequestViewModel, CustomerUiTone } from '@/features/customer/view-models'
import { InfoNotice } from './info-notice'
import { PaymentDeferredPanel } from './payment-deferred-panel'
import { PreliminaryDiagnosisPanel } from './preliminary-diagnosis-panel'

const badgeTones: Record<CustomerUiTone, 'blue' | 'green' | 'amber' | 'red' | 'slate'> = {
  brand: 'blue',
  success: 'green',
  warning: 'amber',
  danger: 'red',
  benefit: 'green',
  neutral: 'slate'
}

export function CustomerRequestDetail({ request }: { request: CustomerRequestViewModel }) {
  const isPaymentDeferred =
    request.status === 'pending_payment' && request.preliminaryPrice !== null

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden p-0 shadow-none">
        <div className="border-b border-slate-100 bg-blue-50/60 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">
                Solicitud {request.id.slice(0, 8)}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                {request.issueLabel}
              </h1>
            </div>
            <Badge tone={badgeTones[request.statusView.tone]}>{request.statusView.label}</Badge>
          </div>
        </div>
        <dl className="grid gap-px bg-slate-100 sm:grid-cols-3">
          <div className="min-w-0 bg-white p-4 sm:p-5">
            <dt className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <MapPin aria-hidden="true" className="h-4 w-4" /> Dirección
            </dt>
            <dd className="mt-2 text-sm font-bold leading-6 text-slate-950">{request.address}</dd>
          </div>
          <div className="min-w-0 bg-white p-4 sm:p-5">
            <dt className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <CalendarClock aria-hidden="true" className="h-4 w-4" /> Franja preferida
            </dt>
            <dd className="mt-2 text-sm font-bold leading-6 text-slate-950">
              {request.preferredWindow}
            </dd>
          </div>
          <div className="min-w-0 bg-white p-4 sm:p-5">
            <dt className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Camera aria-hidden="true" className="h-4 w-4" /> Evidencia
            </dt>
            <dd className="mt-2 text-sm font-bold leading-6 text-slate-950">
              {request.mediaCount} {request.mediaCount === 1 ? 'archivo' : 'archivos'}
            </dd>
          </div>
        </dl>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)] xl:items-start">
        <div className="space-y-5">
          <PreliminaryDiagnosisPanel summary={request.preliminaryDiagnosis} />
          <InfoNotice tone="info" title="Próximo paso" description={request.nextStep} />
        </div>
        {isPaymentDeferred ? (
          <PaymentDeferredPanel
            amount={request.preliminaryPrice ?? 0}
            planLabel={request.urgency === 'priority' ? 'Prioridad' : 'Flexible'}
            compact
          />
        ) : (
          <InfoNotice
            tone="warning"
            title="Solicitud todavía incompleta"
            description="Continuá el asistente para completar los datos que faltan. Ningún cambio se guardará hasta que exista persistencia real."
          />
        )}
      </div>
    </div>
  )
}
