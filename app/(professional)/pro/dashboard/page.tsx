import { PageScaffold } from '@/components/layout/page-scaffold'
import { MetricsGrid } from '@/components/dashboard/metric-card'
import { DataList, DataRow } from '@/components/dashboard/data-list'
import { ButtonLink } from '@/components/ui/button'
import { ActionPanel } from '@/components/workflow/action-panel'
import { professionalMetrics, jobs, jobStatusLabels, serviceRequests, money } from '@/lib/mock/lysto-data'

export default function ProfessionalDashboardPage() {
  return (
    <PageScaffold title="Dashboard profesional" eyebrow="Profesional" description="Agenda, solicitudes asignadas, trabajos en curso, pagos, perfil técnico y calidad.">
      <MetricsGrid metrics={professionalMetrics} />
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <DataList title="Agenda de hoy" description="Trabajos confirmados y próximos estados que tenés que marcar.">
          {jobs.slice(0, 2).map((job) => <DataRow key={job.id} title={`${job.timeWindow} · ${job.customer}`} subtitle={`${job.address} · ${job.issueLabel}`} meta={`${job.equipment} · ${money(job.amount)}`} status={jobStatusLabels[job.status]}><ButtonLink href={`/pro/trabajos/${job.id}`} variant="secondary" size="sm">Operar</ButtonLink></DataRow>)}
        </DataList>
        <ActionPanel title="Checklist antes de salir" description="Reducí errores y reclamos verificando herramientas antes de aceptar una visita." primary="Marcar listo" secondary="Pedir soporte">
          <div className="grid gap-2 text-sm text-slate-300"><span>• Manifold, bomba de vacío y multímetro.</span><span>• Escalera y elementos de seguridad.</span><span>• Confirmar dirección, acceso y estacionamiento.</span></div>
        </ActionPanel>
      </div>
      <DataList title="Solicitudes para responder" description="Aceptar o rechazar rápido mejora tu score interno.">
        {serviceRequests.slice(0, 2).map((request) => <DataRow key={request.id} title={`${request.issueLabel} · ${request.customer}`} subtitle={`${request.address} · ${request.timeWindow}`} meta={`${request.diagnosis} · ${money(request.price)}`} status={request.urgency}><ButtonLink href={`/pro/solicitudes/${request.id}`} variant="secondary" size="sm">Responder</ButtonLink></DataRow>)}
      </DataList>
    </PageScaffold>
  )
}
