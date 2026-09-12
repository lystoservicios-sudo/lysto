import { notFound } from 'next/navigation'
import { ConnectedProfessionalDirectory } from '@/components/admin/connected-professional-directory'
import { requirePageSession } from '@/lib/auth/session'
import { listProfessionalWorkflow } from '@/lib/professional/admin-workflow'
export default async function Page() {
  const session = await requirePageSession('admin')
  if (!session.permissions.some((value) => ['owner', 'operations'].includes(value))) notFound()
  return (
    <ConnectedProfessionalDirectory
      initial={await listProfessionalWorkflow(session, 'professionals')}
    />
  )
}
