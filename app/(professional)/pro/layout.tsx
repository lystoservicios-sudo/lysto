import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/page-shell'
import { ProWorkspace } from '@/components/pro/pro-ui'
import '@/components/pro/pro.css'
import { requirePageSession } from '@/lib/auth/session'
import { readAccountIdentity } from '@/lib/auth/account-identity'
export const dynamic = 'force-dynamic'
export default async function ProfessionalLayout({ children }: { children: ReactNode }) {
  const session = await requirePageSession('professional')
  return <AppShell role="Profesional" identity={await readAccountIdentity(session)}><ProWorkspace>{children}</ProWorkspace></AppShell>
}
