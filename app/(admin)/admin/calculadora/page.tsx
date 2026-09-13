import { PricingCalculator } from '@/components/pricing/pricing-calculator'
import { requirePageSession } from '@/lib/auth/session'
import { notFound } from 'next/navigation'
export default async function Page() {
  const session = await requirePageSession('admin')
  const canOperations = session.permissions.some((permission) =>
    ['owner', 'operations'].includes(permission)
  )
  const canFinance = session.permissions.some((permission) =>
    ['owner', 'finance'].includes(permission)
  )
  if (!canOperations && !canFinance) notFound()
  return <PricingCalculator canFinance={canFinance} canOperations={canOperations} />
}
