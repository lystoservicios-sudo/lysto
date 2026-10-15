import type { ReactNode } from 'react'
import { ClientAppShell } from '@/components/app-shell/client-app-shell'
import { requirePageSession } from '@/lib/auth/session'
import { readAccountIdentity } from '@/lib/auth/account-identity'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolvedCustomerDestination } from '@/lib/auth/customer-session'
import { safeCustomerNext } from '@/lib/auth/customer-access'
import { readCustomerPreferences } from '@/lib/customer-account/service'
export const dynamic = 'force-dynamic'
export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const next = safeCustomerNext((await headers()).get('x-lysto-path'))
  const destination = await resolvedCustomerDestination(next)
  if (destination !== next) redirect(destination)
  const session = await requirePageSession('customer')
  const [identity, preferences] = await Promise.all([
    readAccountIdentity(session),
    // A preference failure must not block a service/payment. Settings surface it.
    readCustomerPreferences(session).catch(() => null)
  ])
  return <ClientAppShell identity={identity} reduceMotion={preferences?.preferences.reduceMotion ?? false}>{children}</ClientAppShell>
}
