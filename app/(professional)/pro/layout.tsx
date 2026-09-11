import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/page-shell'
import { ProWorkspace } from '@/components/pro/pro-ui'
import '@/components/pro/pro.css'
import { requirePageSession } from '@/lib/auth/session'
export const dynamic = 'force-dynamic'
export default async function ProfessionalLayout({ children }: { children: ReactNode }) {
  await requirePageSession('professional')
  return <AppShell role="Profesional"><ProWorkspace>{children}</ProWorkspace></AppShell>
}
