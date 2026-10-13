'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import type { AccountIdentity } from '@/lib/auth/account-identity'
import { ClientBottomNavigation } from './client-bottom-navigation'
import { shouldShowClientBottomNavigation } from './client-navigation'
import { ClientTopBar } from './client-top-bar'
import { ClientFlowProvider, useClientNavigationFocused } from './client-flow-context'

export function ClientAppShell({ children, identity }: { children: ReactNode; identity?: AccountIdentity }) {
  return <ClientFlowProvider><ClientAppShellContent identity={identity}>{children}</ClientAppShellContent></ClientFlowProvider>
}

function ClientAppShellContent({ children, identity }: { children: ReactNode; identity?: AccountIdentity }) {
  const pathname = usePathname()
  const focused = useClientNavigationFocused()
  const showBottomNavigation = shouldShowClientBottomNavigation(pathname) && !focused

  return (
    <div data-client-app-shell data-client-focused={focused || undefined} className="client-app-shell">
      <a className="lysto-skip-link" href="#main-content">Saltar al contenido</a>
      <ClientTopBar identity={identity} />
      <main id="main-content" tabIndex={-1} className="client-app-content">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
      {showBottomNavigation ? <ClientBottomNavigation /> : null}
    </div>
  )
}
