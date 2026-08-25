import { CustomerJobList } from '@/components/customer/customer-job-list'
import { PageScaffold } from '@/components/layout/page-scaffold'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'

export default function CustomerJobsPage() {
  return <PageScaffold title="Mis trabajos" eyebrow="Cliente · Demostración" description="Seguí cada visita, revisá decisiones pendientes y consultá los servicios finalizados."><CustomerJobList jobs={customerDemoFixtures.jobs} /></PageScaffold>
}
