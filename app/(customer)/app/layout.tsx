import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/page-shell'
import { requirePageSession } from '@/lib/auth/session'
import { readAccountIdentity } from '@/lib/auth/account-identity'
export const dynamic = 'force-dynamic'
export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const session = await requirePageSession('customer')
  return <AppShell role="Cliente" identity={await readAccountIdentity(session)}>{children}</AppShell>
}
