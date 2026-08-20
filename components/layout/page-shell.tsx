import Link from 'next/link'
import type { ReactNode } from 'react'
import { AppNavigation } from './app-navigation'
import type { AppRole } from './app-navigation-config'
import { MarketingHeader } from './marketing-header'

export function PublicShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen lysto-gradient"><MarketingHeader />{children}</div>
}

export function AppShell({ children, role }: { children: ReactNode; role: AppRole }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-black">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-lysto-blue text-white">L</span>
            Lysto
          </Link>
          <AppNavigation role={role} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
