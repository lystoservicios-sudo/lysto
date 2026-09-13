import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import { AppSidebar } from './app-sidebar'
import type { AppRole } from './app-navigation-config'
import { AppShellProvider } from './app-shell-provider'
import { AppTopbar } from './app-topbar'
import { MarketingHeader } from './marketing-header'
import { MarketingFooter } from '@/components/marketing/shared'

export function PublicShell({ children }: { children: ReactNode }) {
  return <div className="m-site"><a href="#contenido" className="m-skip-link">Saltar al contenido</a><MarketingHeader /><div id="contenido" tabIndex={-1}>{children}</div><MarketingFooter /></div>
}

export async function AppShell({ children, role }: { children: ReactNode; role: AppRole }) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  return (
    <AppShellProvider defaultOpen={defaultOpen}>
      <div data-app-shell-content className="flex min-h-screen w-full bg-[var(--lysto-canvas)] text-[var(--lysto-ink)]">
        <a
          href="#main-content"
          className="lysto-skip-link fixed left-4 top-4 z-[60] -translate-y-24 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-transform duration-150 focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        >
          Saltar al contenido
        </a>
        <AppSidebar role={role} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar role={role} />
          <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-8 pt-6 md:px-6 md:pt-8">
            <div className="mx-auto w-full max-w-[90rem]">{children}</div>
          </main>
        </div>
      </div>
    </AppShellProvider>
  )
}
