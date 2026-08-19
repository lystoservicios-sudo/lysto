import { PageScaffold } from '@/components/layout/page-scaffold'
import { ProfessionalCard } from '@/components/business/professional-card'
import { RecordList, RecordRow } from '@/components/business/record-list'
import { Button } from '@/components/ui/button'
import { professionals, jobs } from '@/lib/mock/lysto-data'

export default function AdminProfessionalDetailPage() {
  const professional = professionals[0]
  return <PageScaffold title={professional.name} eyebrow="Admin" description="Ficha profesional, documentos, performance, trabajos, pagos y decisiones de calidad."><div className="grid gap-5 lg:grid-cols-[0.8fr_1fr]"><ProfessionalCard professional={professional} /><RecordList title="Historial de trabajos">{jobs.map((job) => <RecordRow key={job.id} title={job.id} subtitle={`${job.customer} · ${job.issueLabel}`} meta={job.nextAction}><Button variant="secondary">Ver</Button></RecordRow>)}</RecordList></div></PageScaffold>
}
