import { AirConditioningWizard } from '@/features/service-request/air-conditioning-wizard'
import { requirePageSession } from '@/lib/auth/session'
import { readCustomerHomes } from '@/lib/customer-homes/service'
import { AIR_CONDITIONING_ISSUES } from '@/lib/domain/constants'

export default async function RequestAirConditioningPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePageSession('customer')
  const data = await readCustomerHomes(session)
  const params = await searchParams
  const requestedIssue = params?.problema
  const initialIssue = typeof requestedIssue === 'string'
    ? AIR_CONDITIONING_ISSUES.find(issue => issue.slug === requestedIssue)?.slug
    : undefined
  return (
      <AirConditioningWizard
        customerId={session.customerId}
        initialData={data}
        initialIssue={initialIssue}
        initialEquipmentId={typeof params?.equipo === 'string' ? params.equipo : undefined}
      />
  )
}
