import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/page-shell'
import { AdminWorkspace } from '@/components/admin/admin-ui'
import '@/components/admin/admin.css'
import { requirePageSession } from '@/lib/auth/session'
import { readAccountIdentity } from '@/lib/auth/account-identity'
export const dynamic = 'force-dynamic'
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requirePageSession('admin')
  return (
    <AppShell
      role="Admin"
      identity={await readAccountIdentity(session)}
      adminPermissions={session.permissions}
    >
      <AdminWorkspace permissions={session.permissions}>{children}</AdminWorkspace>
    </AppShell>
  )
}
