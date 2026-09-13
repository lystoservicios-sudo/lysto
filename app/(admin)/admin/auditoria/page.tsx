import { ConnectedAdminAudit } from '@/components/admin/connected-admin-audit'
import { requirePageSession } from '@/lib/auth/session'
import { listAdminWorkflow } from '@/lib/admin/permissions-service'

export default async function Page() {
  return (
    <ConnectedAdminAudit
      initial={await listAdminWorkflow(await requirePageSession('admin'), 'audit')}
    />
  )
}
