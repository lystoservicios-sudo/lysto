import { Calendar, Target, ShieldCheck } from 'lucide-react'
import { RequestCard } from '@/components/pro/ui/request-card'
import { MetricCard } from '@/components/pro/ui/metric-card'
import { SectionHeader } from '@/components/pro/ui/section-header'
import { serviceRequests } from '@/lib/mock/lysto-data'

export default function ProfessionalRequestsPage() {
  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Profesional"
        title={
          <span className="flex items-center gap-2">
            Solicitudes asignadas
            <span className="text-lysto-warning">★</span>
          </span>
        }
        subtitle="Oportunidades seleccionadas para vos según tu especialidad, zona y disponibilidad."
      />

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard
          icon={<Calendar className="h-4 w-4" />}
          label="Disponibilidad"
          value="Alta"
          description="Hoy tenés disponibilidad"
          tone="blue"
        />
        <MetricCard
          icon={<Target className="h-4 w-4" />}
          label="Compatibilidad"
          value="92%"
          description="Los trabajos te coinciden"
          tone="green"
        />
        <MetricCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Pago protegido"
          value="100%"
          description="Con respaldo de Lysto"
          tone="slate"
        />
      </div>

      {/* Section title */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-black text-lysto-ink">
          Nuevas oportunidades para vos{' '}
          <span className="text-lysto-blue">{serviceRequests.length}</span>
        </h2>
        <button className="text-sm font-semibold text-lysto-muted flex items-center gap-1">
          Más recientes ▾
        </button>
      </div>

      {/* Request cards */}
      <div className="space-y-3">
        {serviceRequests.map(request => (
          <RequestCard key={request.id} request={request} />
        ))}
      </div>

      {/* Footer banner */}
      <div className="rounded-2xl bg-lysto-blueSoft border border-blue-100 p-4 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-lysto-blue shrink-0" />
        <div>
          <p className="text-sm font-bold text-lysto-ink">Tu tiempo es valioso, nosotros te acompañamos.</p>
          <p className="text-xs text-lysto-muted">Si aceptás, el cliente será notificado y te contactará para coordinar.</p>
        </div>
        <button className="shrink-0 text-lysto-blue text-sm font-bold">Más información →</button>
      </div>
    </div>
  )
}
