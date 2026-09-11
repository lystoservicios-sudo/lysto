'use client'

import { PanelLeft } from 'lucide-react'

import { appRoleLabels, type AppRole } from './app-navigation-config'
import { useAppShell } from './app-shell-provider'
import type { AccountIdentity } from '@/lib/auth/account-identity'

export function AppTopbar({ role, identity }: { role: AppRole; identity?: AccountIdentity }) {
  const {
    desktopOpen,
    isMobile,
    mobileOpen,
    toggleSidebar,
    triggerRef
  } = useAppShell()

  const triggerLabel = isMobile
    ? mobileOpen ? 'Cerrar navegación' : 'Abrir navegación'
    : desktopOpen ? 'Contraer navegación' : 'Expandir navegación'

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white px-4 md:px-6">
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-controls={isMobile ? 'mobile-app-navigation' : undefined}
        aria-expanded={isMobile ? mobileOpen : desktopOpen}
        title={`${triggerLabel} (Ctrl+B)`}
        onClick={toggleSidebar}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        <PanelLeft aria-hidden="true" className="h-5 w-5" />
      </button>

      <div className="h-6 w-px bg-slate-200" aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-950">{appRoleLabels[role]}</p>
        <p className="truncate text-xs font-medium text-slate-500" title={identity?.email}>{identity?.name ?? 'Centro de servicio Lysto'}</p>
      </div>

      {identity && <form action="/auth/logout" method="post"><button type="submit" className="min-h-11 rounded-xl px-3 text-sm font-bold text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600">Cerrar sesión</button></form>}
      <div className="hidden items-center gap-2 text-xs font-medium text-slate-500 xl:flex">
        <span>Alternar menú</span>
        <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 font-sans text-[0.6875rem] font-semibold text-slate-600">Ctrl B</kbd>
      </div>
    </header>
  )
}
