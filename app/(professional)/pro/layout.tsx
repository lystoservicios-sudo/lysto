import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/page-shell'
import { ProWorkspace } from '@/components/pro/pro-ui'
import '@/components/pro/pro.css'
export default function ProfessionalLayout({ children }: { children: ReactNode }) { return <AppShell role="Profesional"><ProWorkspace>{children}</ProWorkspace></AppShell> }
