import { PageScaffold } from '@/components/layout/page-scaffold'
import { AirConditioningWizard } from '@/features/service-request/air-conditioning-wizard'
import { requirePageSession } from '@/lib/auth/session'
import { listCustomerAddresses } from '@/lib/customer-assets/service'

export default async function RequestAirConditioningPage() {
  const addresses = await listCustomerAddresses(await requirePageSession('customer'))
  return (
    <PageScaffold
      title="Solicitar servicio"
      eyebrow="Cliente"
      description="Contanos qué necesitás y revisá tu presupuesto. Solo se guarda cuando lo indicás. Sin cobros en esta etapa."
    >
      <AirConditioningWizard savedAddresses={addresses} />
    </PageScaffold>
  )
}
