import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/page-shell'
import { AdminWorkspace } from '@/components/admin/admin-ui'
import '@/components/admin/admin.css'
export default function AdminLayout({ children }: { children: ReactNode }) { return <AppShell role="Admin"><AdminWorkspace>{children}</AdminWorkspace></AppShell> }
