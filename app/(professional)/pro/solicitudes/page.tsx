import { PageScaffold } from '@/components/layout/page-scaffold'
import { DataList, DataRow } from '@/components/dashboard/data-list'
import { ButtonLink } from '@/components/ui/button'
import { serviceRequests, money } from '@/lib/mock/lysto-data'

export default function ProfessionalRequestsPage() {
  return (
    <PageScaffold title="Solicitudes asignadas" eyebrow="Profesional" description="Pedidos enviados por Lysto para aceptar o rechazar según disponibilidad real.">
      <DataList title="Pendientes de respuesta" description="Vas a ver diagnóstico preliminar, fotos/video, dirección, horario, precio y detalles de acceso.">
        {serviceRequests.map((request) => <DataRow key={request.id} title={`${request.issueLabel} · ${request.customer}`} subtitle={`${request.address} · ${request.timeWindow}`} meta={`${request.diagnosis} · ${money(request.price)}`} status={request.status}><ButtonLink href={`/pro/solicitudes/${request.id}`} variant="secondary" size="sm">Ver solicitud</ButtonLink></DataRow>)}
      </DataList>
    </PageScaffold>
  )
}
