import { notFound } from 'next/navigation'
import { ConnectedProfessionalPolicies } from '@/components/admin/connected-professional-policies'
import { requirePageSession } from '@/lib/auth/session'
import { listProfessionalPolicies } from '@/lib/professional/professional-policies'

export default async function Page() {
  const session = await requirePageSession('admin')
  if (!session.permissions.some(value => value === 'owner' || value === 'operations')) notFound()
  return <ConnectedProfessionalPolicies initial={await listProfessionalPolicies(session)} />
}
