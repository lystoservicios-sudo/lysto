import { ConnectedCustomerMaintenance } from '@/components/customer/connected-customer-maintenance'
import { PageScaffold } from '@/components/layout/page-scaffold'

export default function CustomerMaintenancePage() {
  return (
    <PageScaffold
      title="Mantenimientos recomendados"
      eyebrow="Postventa"
      description="Entendé qué cuidado necesita cada equipo y cuándo conviene revisarlo."
    >
      <ConnectedCustomerMaintenance />
    </PageScaffold>
  )
}
