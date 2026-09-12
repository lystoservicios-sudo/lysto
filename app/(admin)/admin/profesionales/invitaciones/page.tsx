import { notFound } from 'next/navigation'
import { ConnectedProfessionalInvitations } from '@/components/admin/connected-professional-invitations'
import { requirePageSession } from '@/lib/auth/session'
import { listProfessionalWorkflow } from '@/lib/professional/admin-workflow'
import { professionalCatalog } from '@/lib/professional/onboarding-context'
export default async function Page() {
  const session = await requirePageSession('admin')
  if (!session.permissions.some((value) => ['owner', 'operations'].includes(value))) notFound()
  const [initial, catalog] = await Promise.all([
    listProfessionalWorkflow(session, 'invitations'),
    professionalCatalog(session.client)
  ])
  return <ConnectedProfessionalInvitations initial={initial} categories={catalog.categories} />
}
