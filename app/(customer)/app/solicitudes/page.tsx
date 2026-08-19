import { PageScaffold } from '@/components/layout/page-scaffold'
import { RequestCard } from '@/components/business/request-card'
import { requests } from '@/lib/mock/lysto-data'

export default function CustomerRequestsPage() {
  return <PageScaffold title="Mis solicitudes" eyebrow="Cliente" description="Borradores, solicitudes pagadas, búsqueda de técnico y solicitudes históricas."><div className="grid gap-4">{requests.map((request) => <RequestCard key={request.id} request={request} href={`/app/solicitudes/${request.id}`} />)}</div></PageScaffold>
}
