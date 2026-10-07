'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import type { AccountIdentity } from '@/lib/auth/account-identity'
import { ClientBottomNavigation } from './client-bottom-navigation'
import { shouldShowClientBottomNavigation } from './client-navigation'
import { ClientTopBar } from './client-top-bar'

export function ClientAppShell({ children, identity }: { children: ReactNode; identity?: AccountIdentity }) {
  const pathname = usePathname()
  const showBottomNavigation = shouldShowClientBottomNavigation(pathname)

  return (
    <div data-client-app-shell className="client-app-shell">
      <a className="lysto-skip-link" href="#main-content">Saltar al contenido</a>
      <ClientTopBar identity={identity} />
      <main id="main-content" tabIndex={-1} className="client-app-content">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
      {showBottomNavigation ? <ClientBottomNavigation /> : null}
    </div>
  )
}
