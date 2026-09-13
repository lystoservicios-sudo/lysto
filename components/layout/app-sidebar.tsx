'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  AirVent,
  BarChart3,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  CreditCard,
  GraduationCap,
  Home,
  LayoutDashboard,
  LifeBuoy,
  PlusCircle,
  SearchCheck,
  ShieldCheck,
  Users,
  Wrench,
  X,
  type LucideIcon
} from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

import {
  appNavigation,
  appRoleLabels,
  isNavigationItemActive,
  type AppNavigationIcon,
  type AppRole
} from './app-navigation-config'
import { useAppShell } from './app-shell-provider'
import { cn } from '@/lib/utils/cn'
import { canAccessAdminModule } from '@/components/admin/admin-model'

const navigationIcons: Record<AppNavigationIcon, LucideIcon> = {
  home: Home,
  plus: PlusCircle,
  work: Wrench,
  equipment: AirVent,
  calendar: CalendarDays,
  quality: ShieldCheck,
  payments: CreditCard,
  dashboard: LayoutDashboard,
  requests: ClipboardList,
  training: GraduationCap,
  support: LifeBuoy,
  professionals: Users,
  matching: SearchCheck,
  reports: BarChart3
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Lysto, inicio"
      className={cn(
        'flex min-w-0 items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
        compact ? 'justify-center' : 'gap-3'
      )}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.65rem] bg-blue-600 text-sm font-black text-white">
        L
      </span>
      <span className={cn('min-w-0', compact && 'sr-only')}>
        <span className="block truncate text-base font-extrabold tracking-[-0.02em] text-slate-950">Lysto</span>
        <span className="block truncate text-xs font-medium text-slate-500">Servicio técnico</span>
      </span>
    </Link>
  )
}

function NavigationItems({ role, compact = false, onNavigate, adminPermissions }: {
  role: AppRole
  compact?: boolean
  onNavigate?: () => void
  adminPermissions: readonly string[]
}) {
  const pathname = usePathname()
  const items = appNavigation[role].filter(
    (item) => role !== 'Admin' || canAccessAdminModule(item.href.replace('/admin/', ''), adminPermissions)
  )

  return (
    <nav aria-label={`Secciones de ${appRoleLabels[role]}`} className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
      <p className={cn('px-2 pb-2 text-xs font-semibold text-slate-500', compact && 'sr-only')}>
        Navegación
      </p>
      <ul className="space-y-1">
        {items.map(({ label, href, icon }) => {
          const Icon = navigationIcons[icon]
          const isActive = isNavigationItemActive(pathname, href)

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                data-active={isActive}
                title={compact ? label : undefined}
                onClick={onNavigate}
                className={cn(
                  'group relative flex min-h-11 items-center rounded-xl text-sm font-semibold transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
                  compact ? 'justify-center px-2' : 'gap-3 px-3',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 active:bg-slate-200'
                )}
              >
                <Icon aria-hidden="true" className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2} />
                <span className={cn('min-w-0 flex-1 truncate', compact && 'sr-only')}>{label}</span>
                {isActive ? (
                  compact
                    ? <span aria-hidden="true" className="absolute ml-9 h-1.5 w-1.5 rounded-full bg-blue-600" />
                    : <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100"><ChevronRight className="h-3.5 w-3.5" /></span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function SidebarFooter({ compact = false }: { compact?: boolean }) {
  return (
    <div className="border-t border-slate-200/80 p-2">
      <div className={cn('rounded-xl bg-slate-100/80 text-slate-600', compact ? 'grid h-10 place-items-center' : 'px-3 py-2.5')}>
        <ShieldCheck aria-hidden="true" className={cn('h-4 w-4 shrink-0', !compact && 'float-left mr-2 mt-0.5')} />
        <span className={cn('text-xs font-semibold leading-5', compact && 'sr-only')}>Base de navegación</span>
        <span className={cn('block text-[0.6875rem] leading-4 text-slate-500', compact && 'sr-only')}>Estructura temporal por rol</span>
      </div>
    </div>
  )
}

function DesktopSidebar({ role, adminPermissions }: { role: AppRole; adminPermissions: readonly string[] }) {
  const { desktopOpen } = useAppShell()

  return (
    <aside
      aria-label={`Navegación de ${appRoleLabels[role]}`}
      data-state={desktopOpen ? 'expanded' : 'collapsed'}
      className={cn(
        'lysto-shell-sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200/80 bg-white md:flex',
        'transition-[width] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)]',
        desktopOpen ? 'w-64' : 'w-14'
      )}
    >
      <div className={cn('flex h-16 shrink-0 items-center border-b border-slate-200/80', desktopOpen ? 'px-4' : 'justify-center px-2')}>
        <Brand compact={!desktopOpen} />
      </div>
      <NavigationItems role={role} compact={!desktopOpen} adminPermissions={adminPermissions} />
      <SidebarFooter compact={!desktopOpen} />
    </aside>
  )
}

function MobileSidebar({ role, adminPermissions }: { role: AppRole; adminPermissions: readonly string[] }) {
  const { mobileOpen, setMobileOpen, triggerRef } = useAppShell()
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (mobileOpen) {
      wasOpen.current = true
      closeRef.current?.focus()
      return
    }

    if (wasOpen.current) {
      wasOpen.current = false
      triggerRef.current?.focus()
    }
  }, [mobileOpen, triggerRef])

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []
    )
    const first = focusable[0]
    const last = focusable.at(-1)

    if (!first || !last) return

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!mobileOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="Cerrar navegación al tocar fuera"
        onClick={() => setMobileOpen(false)}
        className="lysto-shell-backdrop absolute inset-0 h-full w-full bg-slate-950/45"
      />
      <aside
        ref={dialogRef}
        id="mobile-app-navigation"
        role="dialog"
        aria-modal="true"
        aria-label="Navegación principal"
        onKeyDown={handleDialogKeyDown}
        className="lysto-shell-drawer absolute inset-y-0 left-0 flex w-[min(18rem,calc(100vw-2rem))] flex-col bg-white shadow-xl"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-4">
          <button
            ref={closeRef}
            type="button"
            aria-label="Cerrar navegación"
            onClick={() => setMobileOpen(false)}
            className="order-2 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
          <div className="order-1 min-w-0">
            <Brand />
          </div>
        </div>
        <div className="px-4 pt-4">
          <p className="text-sm font-bold text-slate-950">{appRoleLabels[role]}</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">Accesos temporales para validar la estructura.</p>
        </div>
        <NavigationItems role={role} onNavigate={() => setMobileOpen(false)} adminPermissions={adminPermissions} />
        <SidebarFooter />
      </aside>
    </div>,
    document.body
  )
}

export function AppSidebar({
  role,
  adminPermissions = ['owner']
}: {
  role: AppRole
  adminPermissions?: readonly string[]
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <>
      <DesktopSidebar role={role} adminPermissions={adminPermissions} />
      {mounted ? <MobileSidebar role={role} adminPermissions={adminPermissions} /> : null}
    </>
  )
}
