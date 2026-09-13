import { CalendarClock, MapPin, MonitorCog, ReceiptText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { CustomerJobViewModel, CustomerUiTone } from '@/features/customer/view-models'
import { TechnicianEtaCard, TechnicianProfileCard } from './active-service-card'
import { ChatSupportBanner } from './chat-support-banner'
import { CustomerApprovalPanel } from './customer-approval-panel'
import { DiagnosisComparison } from './diagnosis-comparison'
import { InfoNotice } from './info-notice'
import { LiveTrackingCard } from './live-tracking-card'
import { PaymentDeferredAction } from './payment-deferred-panel'
import { ServiceStageTracker, currentCustomerJobStage } from './service-stage-tracker'

const badgeTones: Record<CustomerUiTone, 'blue' | 'green' | 'amber' | 'red' | 'slate'> = {
  brand: 'blue',
  success: 'green',
  warning: 'amber',
  danger: 'red',
  benefit: 'green',
  neutral: 'slate'
}
const stageCopy = [
  'Lysto está preparando la asignación del servicio.',
  'El profesional aceptó la visita y quedó asociado al trabajo.',
  'El profesional informó su salida hacia el domicilio.',
  'La llegada debe confirmarse antes de iniciar el diagnóstico.',
  'El profesional revisa el equipo y documenta lo encontrado.',
  'Cualquier cambio de alcance requiere una decisión explícita del cliente.',
  'El trabajo puede comenzar únicamente después de las aprobaciones necesarias.',
  'El cierre reúne informe, comprobante, garantía y calificación.'
] as const

const dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'UTC' })
const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0
})

export function CustomerJobDetail({ job }: { job: CustomerJobViewModel }) {
  const stage = currentCustomerJobStage(job.status)
  const needsApproval = job.status === 'waiting_customer_approval'
  const needsCloseout = job.status === 'completed_pending_customer_confirmation'

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden p-0 shadow-none">
        <div className="border-b border-slate-100 bg-blue-50/60 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">
                Trabajo {job.id.slice(0, 8)}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                {job.issueLabel}
              </h1>
            </div>
            <Badge tone={badgeTones[job.statusView.tone]}>{job.statusView.label}</Badge>
          </div>
        </div>
        <dl className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-4">
          <Fact icon={MapPin} label="Dirección" value={job.address} />
          <Fact
            icon={CalendarClock}
            label="Visita"
            value={`${dateFormatter.format(new Date(job.scheduledAt))} · ${job.timeWindow}`}
          />
          <Fact icon={MonitorCog} label="Equipo" value={job.equipmentName ?? 'Por confirmar'} />
          <Fact
            icon={ReceiptText}
            label="Importe informado"
            value={
              job.finalAmount != null
                ? currencyFormatter.format(job.finalAmount)
                : job.amount != null
                  ? currencyFormatter.format(job.amount)
                  : 'Pendiente'
            }
          />
        </dl>
      </Card>

      <Card className="shadow-none">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            Recorrido del servicio
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            Ocho etapas, un próximo paso claro
          </h2>
        </div>
        <ServiceStageTracker status={job.status} />
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="min-w-0 space-y-5">
          <InfoNotice
            tone={
              needsApproval || needsCloseout
                ? 'warning'
                : job.status === 'completed'
                  ? 'success'
                  : 'info'
            }
            title="Parte actual"
            description={
              <>
                <span>{stageCopy[stage]}</span>
                <br />
                <strong>Próximo paso:</strong> {job.nextStep}
              </>
            }
          />
          <DiagnosisComparison
            preliminaryDiagnosis={job.preliminaryDiagnosis}
            professionalDiagnosis={job.professionalDiagnosis}
            preliminaryAmount={job.preliminaryAmount}
            finalAmount={job.finalAmount}
            priceChangeReason={job.priceChangeReason}
          />
          {needsApproval ? (
            <>
              <CustomerApprovalPanel />
              <PaymentDeferredAction action="reserve" />
            </>
          ) : null}
          {needsCloseout ? <CustomerApprovalPanel context="closeout" jobId={job.id} /> : null}
          {job.status === 'completed' ? <PaymentDeferredAction action="receipt" /> : null}
          {job.canReview ? (
            <Card className="shadow-none">
              <h2 className="text-lg font-black text-slate-950">Tu opinión es opcional</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                El servicio ya quedó confirmado. Podés calificarlo ahora o más adelante sin cambiar
                el cierre ni el pago.
              </p>
              <ButtonLink href={`/app/trabajos/${job.id}/review`} className="mt-4">
                Calificar servicio
              </ButtonLink>
            </Card>
          ) : null}
          <InfoNotice
            tone="security"
            title="Información transparente"
            description="El seguimiento muestra únicamente eventos informados. No inventa posiciones, mensajes, aprobaciones ni cambios de estado."
          />
        </div>

        <aside className="min-w-0 space-y-4" aria-label="Información del profesional y seguimiento">
          <TechnicianProfileCard
            name={job.professionalName}
            specialty={job.professionalSpecialty}
            rating={job.professionalRating}
            license={job.professionalLicense}
            verified={job.professionalVerified}
          />
          <TechnicianEtaCard scheduledAt={job.scheduledAt} timeWindow={job.timeWindow} />
          <LiveTrackingCard status={job.trackingStatus} />
          <ChatSupportBanner />
        </aside>
      </div>
    </div>
  )
}

function Fact({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="min-w-0 bg-white p-4 sm:p-5">
      <dt className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Icon aria-hidden="true" className="h-4 w-4" />
        {label}
      </dt>
      <dd className="mt-2 text-sm font-bold leading-6 text-slate-950">{value}</dd>
    </div>
  )
}
