import { PageScaffold } from '@/components/layout/page-scaffold'
import { DataList, DataRow } from '@/components/dashboard/data-list'
import { jobs } from '@/lib/mock/lysto-data'

export default function ProfessionalAgendaPage() {
  return (
    <PageScaffold title="Agenda profesional" eyebrow="Profesional" description="Calendario operativo por día, franja horaria y zona.">
      <DataList title="Hoy">
        {jobs.map((job) => <DataRow key={job.id} title={`${job.timeWindow} · ${job.customer}`} subtitle={`${job.address} · ${job.issueLabel}`} meta={job.nextStep} status={job.status} />)}
      </DataList>
    </PageScaffold>
  )
}
