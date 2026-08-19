import { PageScaffold } from '@/components/layout/page-scaffold'
import { RecordList, RecordRow } from '@/components/business/record-list'
import { auditEvents } from '@/lib/mock/lysto-data'

export default function AdminAuditPage() {
  return <PageScaffold title="Auditoría" eyebrow="Admin" description="Registro obligatorio de acciones críticas: profesionales, trabajos, pagos, precios y calidad."><RecordList title="Eventos recientes">{auditEvents.map((event) => <RecordRow key={event.id} title={event.action} subtitle={`${event.actor} · ${event.entity}`} meta={event.date} />)}</RecordList></PageScaffold>
}
