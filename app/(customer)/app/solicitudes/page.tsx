import { CustomerRequestList } from '@/components/customer/customer-request-list'
import { PageScaffold } from '@/components/layout/page-scaffold'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'

export default function CustomerRequestsPage() {
  return (
    <PageScaffold
      title="Mis solicitudes"
      eyebrow="Cliente · Demostración"
      description="Revisá borradores, solicitudes que necesitan atención y el próximo paso de cada servicio."
    >
      <CustomerRequestList requests={customerDemoFixtures.requests} />
    </PageScaffold>
  )
}
