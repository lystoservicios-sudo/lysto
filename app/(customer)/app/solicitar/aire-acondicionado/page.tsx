import { PageScaffold } from '@/components/layout/page-scaffold'
import { AirConditioningWizard } from '@/features/service-request/air-conditioning-wizard'
import { requirePageSession } from '@/lib/auth/session'
import { listCustomerAddresses } from '@/lib/customer-assets/service'
import { isOwnerMaintenanceTestCustomer } from '@/lib/pricing/owner-maintenance-test-price'

export default async function RequestAirConditioningPage() {
  const session = await requirePageSession('customer')
  const [{ data: identity }, addresses] = await Promise.all([
    session.client.auth.getUser(),
    listCustomerAddresses(session)
  ])
  const ownerTestCustomer = isOwnerMaintenanceTestCustomer(identity.user?.email, 'mantenimiento')
  return (
    <PageScaffold
      title="Solicitar servicio"
      eyebrow="Cliente"
      description="Contanos qué necesitás y revisá tu presupuesto. Solo se guarda cuando lo indicás. Sin cobros en esta etapa."
    >
      <AirConditioningWizard
        savedAddresses={addresses}
        ownerMaintenanceTestCustomer={ownerTestCustomer}
      />
    </PageScaffold>
  )
}
