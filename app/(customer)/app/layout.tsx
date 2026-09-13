import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/page-shell'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { readCustomerSession } from '@/lib/auth/customer-session'
import { customerDestination, safeCustomerNext } from '@/lib/auth/customer-access'

export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const next = safeCustomerNext((await headers()).get('x-lysto-path'))
  const session = await readCustomerSession().catch(() => null)
  if (!session) redirect('/login?notice=unavailable')
  if (session.kind === 'anonymous') redirect(`/login?next=${encodeURIComponent(next)}`)
  if (session.kind === 'unavailable') redirect('/login?notice=account-unavailable')
  const destination = customerDestination(session, next)
  if (destination !== next) redirect(destination)
  return <AppShell role="Cliente">{children}</AppShell>
}
