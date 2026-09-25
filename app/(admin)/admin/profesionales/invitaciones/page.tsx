import { notFound } from 'next/navigation'
import { ConnectedProfessionalInvitations } from '@/components/admin/connected-professional-invitations'
import { requirePageSession } from '@/lib/auth/session'
import { professionalCatalog } from '@/lib/professional/onboarding-context'
export default async function Page() {
  const session = await requirePageSession('admin')
  if (!session.permissions.some((value) => ['owner', 'operations'].includes(value))) notFound()
  const catalog = await professionalCatalog(session.client)
  return <ConnectedProfessionalInvitations categories={catalog.categories} />
}
