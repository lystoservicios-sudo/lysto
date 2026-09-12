import { notFound } from 'next/navigation'
import { ConnectedAdminPermissions } from '@/components/admin/connected-admin-permissions'
import { requirePageSession } from '@/lib/auth/session'
import { listAdminWorkflow } from '@/lib/admin/permissions-service'

export default async function Page() {
  const session = await requirePageSession('admin')
  if (!session.permissions.includes('owner')) notFound()
  return <ConnectedAdminPermissions initial={await listAdminWorkflow(session, 'permissions')} />
}
