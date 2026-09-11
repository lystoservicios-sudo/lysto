import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/page-shell'
import { AdminWorkspace } from '@/components/admin/admin-ui'
import '@/components/admin/admin.css'
import { requirePageSession } from '@/lib/auth/session'
export const dynamic = 'force-dynamic'
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePageSession('admin')
  return <AppShell role="Admin"><AdminWorkspace>{children}</AdminWorkspace></AppShell>
}
