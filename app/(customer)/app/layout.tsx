import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/page-shell'
import { requirePageSession } from '@/lib/auth/session'
export const dynamic = 'force-dynamic'
export default async function CustomerLayout({ children }: { children: ReactNode }) {
  await requirePageSession('customer')
  return <AppShell role="Cliente">{children}</AppShell>
}
