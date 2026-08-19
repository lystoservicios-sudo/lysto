import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/page-shell'
export default function CustomerLayout({ children }: { children: ReactNode }) { return <AppShell role="Cliente">{children}</AppShell> }
