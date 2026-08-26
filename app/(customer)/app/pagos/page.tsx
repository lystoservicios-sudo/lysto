import { CustomerPaymentsCenter } from '@/components/customer/customer-payments-center'
import { PageScaffold } from '@/components/layout/page-scaffold'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'

export default function CustomerPaymentsPage() {
  return <PageScaffold title="Pagos y movimientos" eyebrow="Protección Lysto" description="Revisá cómo funcionarán cobros, comprobantes y devoluciones sin simular operaciones."><CustomerPaymentsCenter movements={customerDemoFixtures.payments.movements} integrationState={customerDemoFixtures.payments.integrationState} /></PageScaffold>
}
