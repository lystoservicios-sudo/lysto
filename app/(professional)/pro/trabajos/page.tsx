import { PageScaffold } from '@/components/layout/page-scaffold'
import { DataList, DataRow } from '@/components/dashboard/data-list'
import { ButtonLink } from '@/components/ui/button'
import { jobs, jobStatusLabels, money } from '@/lib/mock/lysto-data'

export default function ProfessionalJobsPage() {
  return (
    <PageScaffold title="Trabajos profesional" eyebrow="Profesional" description="Trabajos confirmados, en camino, en progreso, pendientes de cierre y finalizados.">
      <DataList title="Mis trabajos" description="Cada cambio de estado impacta en el seguimiento del cliente y auditoría admin.">
        {jobs.map((job) => <DataRow key={job.id} title={`${job.customer} · ${job.issueLabel}`} subtitle={`${job.address} · ${job.timeWindow}`} meta={`${job.equipment} · ${money(job.amount)}`} status={jobStatusLabels[job.status]}><ButtonLink href={`/pro/trabajos/${job.id}`} variant="secondary" size="sm">Operar</ButtonLink></DataRow>)}
      </DataList>
    </PageScaffold>
  )
}
