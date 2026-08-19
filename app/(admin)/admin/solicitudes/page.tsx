import { PageScaffold } from '@/components/layout/page-scaffold'
import { RequestCard } from '@/components/business/request-card'
import { requests } from '@/lib/mock/lysto-data'

export default function AdminRequestsPage() {
  return <PageScaffold title="Solicitudes" eyebrow="Admin" description="Solicitudes nuevas, pagadas, pendientes de asignación, canceladas y vencidas."><div className="grid gap-4">{requests.map((request) => <RequestCard key={request.id} request={request} href={`/admin/solicitudes/${request.id}`} />)}</div></PageScaffold>
}
