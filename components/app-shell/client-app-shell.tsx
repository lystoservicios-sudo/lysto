'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

import type { AccountIdentity } from '@/lib/auth/account-identity'
import { ClientBottomNavigation } from './client-bottom-navigation'
import { shouldShowClientBottomNavigation } from './client-navigation'
import { ClientTopBar } from './client-top-bar'
import { ClientFlowProvider, useClientNavigationFocused } from './client-flow-context'

export function ClientAppShell({ children, identity, reduceMotion = false }: { children: ReactNode; identity?: AccountIdentity; reduceMotion?: boolean }) {
  return <ClientFlowProvider><ClientAppShellContent identity={identity} reduceMotion={reduceMotion}>{children}</ClientAppShellContent></ClientFlowProvider>
}

function ClientAppShellContent({ children, identity, reduceMotion }: { children: ReactNode; identity?: AccountIdentity; reduceMotion: boolean }) {
  const [reduced, setReduced] = useState(reduceMotion)
  useEffect(() => { setReduced(reduceMotion) }, [reduceMotion])
  useEffect(() => {
    const changed = (event: Event) => {
      const detail: unknown = (event as CustomEvent).detail
      if (detail && typeof detail === 'object' && 'reduceMotion' in detail && typeof detail.reduceMotion === 'boolean') setReduced(detail.reduceMotion)
    }
    window.addEventListener('lysto:preferences', changed)
    return () => window.removeEventListener('lysto:preferences', changed)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.lystoReduceMotion = String(reduced)
    window.dispatchEvent(new Event('lysto:motion-change'))
    return () => { delete document.documentElement.dataset.lystoReduceMotion }
  }, [reduced])
  const pathname = usePathname()
  const focused = useClientNavigationFocused()
  const showBottomNavigation = shouldShowClientBottomNavigation(pathname) && !focused

  return (
    <div data-client-app-shell data-client-focused={focused || undefined} data-client-reduce-motion={reduced || undefined} className="client-app-shell">
      <a className="lysto-skip-link" href="#main-content">Saltar al contenido</a>
      <ClientTopBar identity={identity} />
      <main id="main-content" tabIndex={-1} className="client-app-content">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
      {showBottomNavigation ? <ClientBottomNavigation /> : null}
    </div>
  )
}
