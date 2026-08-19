import { PageScaffold } from '@/components/layout/page-scaffold'
import { RecordList, RecordRow } from '@/components/business/record-list'
import { StatusPill } from '@/components/business/status-pill'
import { jobs } from '@/lib/mock/lysto-data'

export default function AdminPaymentsPage() {
  return <PageScaffold title="Pagos" eyebrow="Admin" description="Transacciones, webhooks, comisión Lysto, monto profesional, devoluciones y conciliación."><RecordList title="Pagos Mercado Pago">{jobs.map((job) => <RecordRow key={job.id} title={`${job.id} · $ ${job.amount.toLocaleString('es-AR')}`} subtitle={`Comisión Lysto: $ ${Math.round(job.amount * 0.18).toLocaleString('es-AR')} · Profesional: $ ${Math.round(job.amount * 0.82).toLocaleString('es-AR')}`} meta={job.customer}><StatusPill status={job.paymentStatus} /></RecordRow>)}</RecordList></PageScaffold>
}
