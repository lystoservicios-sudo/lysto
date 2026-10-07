import type { ReactNode } from 'react'
import { ClientAppShell } from '@/components/app-shell/client-app-shell'
import { requirePageSession } from '@/lib/auth/session'
import { readAccountIdentity } from '@/lib/auth/account-identity'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolvedCustomerDestination } from '@/lib/auth/customer-session'
import { safeCustomerNext } from '@/lib/auth/customer-access'
export const dynamic = 'force-dynamic'
export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const next = safeCustomerNext((await headers()).get('x-lysto-path'))
  const destination = await resolvedCustomerDestination(next)
  if (destination !== next) redirect(destination)
  const session = await requirePageSession('customer')
  return <ClientAppShell identity={await readAccountIdentity(session)}>{children}</ClientAppShell>
}
