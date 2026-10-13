import { PageScaffold } from '@/components/layout/page-scaffold'
import { AirConditioningWizard } from '@/features/service-request/air-conditioning-wizard'
import { requirePageSession } from '@/lib/auth/session'
import { listCustomerAddresses } from '@/lib/customer-assets/service'
import { AIR_CONDITIONING_ISSUES } from '@/lib/domain/constants'
import { isOwnerMaintenanceTestCustomer } from '@/lib/pricing/owner-maintenance-test-price'

export default async function RequestAirConditioningPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePageSession('customer')
  const [{ data: identity }, addresses] = await Promise.all([
    session.client.auth.getUser(),
    listCustomerAddresses(session)
  ])
  const requestedIssue = (await searchParams)?.problema
  const initialIssue = typeof requestedIssue === 'string'
    ? AIR_CONDITIONING_ISSUES.find(issue => issue.slug === requestedIssue)?.slug
    : undefined
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
        initialIssue={initialIssue}
      />
    </PageScaffold>
  )
}
