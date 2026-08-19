import { PageScaffold } from '@/components/layout/page-scaffold'
import { RecordList, RecordRow } from '@/components/business/record-list'
import { ButtonLink } from '@/components/ui/button'
import { requests } from '@/lib/mock/lysto-data'

export default function AdminCustomersPage() {
  return <PageScaffold title="Clientes" eyebrow="Admin" description="Clientes, direcciones, equipos, pagos, solicitudes y reviews."><RecordList title="Clientes recientes">{requests.map((request) => <RecordRow key={request.customer} title={request.customer} subtitle={`${request.phone} · ${request.address}`} meta={`Último pedido: ${request.issueLabel}`}><ButtonLink href={`/admin/clientes/${request.id}`} variant="secondary">Ver cliente</ButtonLink></RecordRow>)}</RecordList></PageScaffold>
}
