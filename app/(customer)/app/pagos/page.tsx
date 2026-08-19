import { PageScaffold } from '@/components/layout/page-scaffold'
import { RecordList, RecordRow } from '@/components/business/record-list'
import { StatusPill } from '@/components/business/status-pill'
import { jobs } from '@/lib/mock/lysto-data'

export default function CustomerPaymentsPage() {
  return <PageScaffold title="Pagos" eyebrow="Cliente" description="Pagos, reservas, comprobantes y devoluciones."><RecordList title="Movimientos">{jobs.map((job) => <RecordRow key={job.id} title={`${job.id} · ${job.issueLabel}`} subtitle={`${job.professional} · $ ${job.amount.toLocaleString('es-AR')}`} meta={job.scheduledDate}><StatusPill status={job.paymentStatus} /></RecordRow>)}</RecordList></PageScaffold>
}
