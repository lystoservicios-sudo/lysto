import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/page-shell'
export default function AdminLayout({ children }: { children: ReactNode }) { return <AppShell role="Admin">{children}</AppShell> }
