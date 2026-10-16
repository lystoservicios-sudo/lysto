import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/page-shell'
import { ProWorkspace } from '@/components/pro/pro-ui'
import { ProfessionalRouteShell } from '@/components/pro/professional-route-shell'
import '@/components/pro/pro.css'
import { requireProfessionalWorkspaceSession } from '@/lib/auth/session'
import { readAccountIdentity } from '@/lib/auth/account-identity'
export const dynamic = 'force-dynamic'
export default async function ProfessionalLayout({ children }: { children: ReactNode }) {
  const session = await requireProfessionalWorkspaceSession()
  const pending = session.professionalStatus !== 'approved' || !session.professionalEligible
  return (
    <ProfessionalRouteShell
      standard={
        <AppShell role="Profesional" identity={await readAccountIdentity(session)}>
          <ProWorkspace pending={pending}>{children}</ProWorkspace>
        </AppShell>
      }
    >
      {children}
    </ProfessionalRouteShell>
  )
}
