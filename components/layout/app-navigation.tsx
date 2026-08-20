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
  Menu,
  PlusCircle,
  SearchCheck,
  ShieldCheck,
  Users,
  Wrench,
  X,
  type LucideIcon
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  appNavigation,
  isNavigationItemActive,
  type AppNavigationIcon,
  type AppRole
} from './app-navigation-config'
import { cn } from '@/lib/utils/cn'

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

export function AppNavigation({ role }: { role: AppRole }) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)
  const items = appNavigation[role]

  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current) {
        triggerRef.current?.focus()
        wasOpenRef.current = false
      }
      return
    }

    wasOpenRef.current = true
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  return (
    <div className="ml-auto flex min-w-0 items-center gap-2">
      <nav aria-label="Navegación principal" className="hidden min-w-0 items-center gap-1 lg:flex">
        {items.map(({ label, href }) => {
          const isActive = isNavigationItemActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-bold transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lysto-blue focus-visible:ring-offset-2',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
              )}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 sm:inline-flex">
        {role}
      </span>

      <button
        ref={triggerRef}
        type="button"
        aria-label="Abrir menú"
        aria-expanded={isOpen}
        aria-controls="mobile-app-navigation"
        onClick={() => setIsOpen(true)}
        className={cn(
          'inline-flex min-h-11 items-center gap-2 rounded-xl bg-lysto-blue px-3.5 text-sm font-extrabold text-white lg:hidden',
          'transition-colors duration-150 hover:bg-blue-700 active:bg-blue-800',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lysto-blue focus-visible:ring-offset-2'
        )}
      >
        <Menu aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
        <span>Menú</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú al tocar fuera"
            onClick={() => setIsOpen(false)}
            className="lysto-mobile-backdrop absolute inset-0 bg-slate-950/45"
          />

          <aside
            id="mobile-app-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Menú principal"
            className="lysto-mobile-drawer absolute inset-y-0 left-0 flex w-[min(20rem,calc(100vw-2rem))] flex-col overflow-y-auto bg-white shadow-2xl"
            style={{
              paddingTop: 'max(1rem, env(safe-area-inset-top))',
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))'
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 pb-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-lysto-blue text-lg font-black text-white">
                  L
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-slate-950">Lysto</p>
                  <p className="truncate text-sm font-semibold text-slate-500">Acceso {role.toLowerCase()}</p>
                </div>
              </div>
              <button
                ref={closeRef}
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setIsOpen(false)}
                className={cn(
                  'grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-600',
                  'transition-colors duration-150 hover:bg-slate-100 hover:text-slate-950 active:bg-slate-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lysto-blue'
                )}
              >
                <X aria-hidden="true" className="h-6 w-6" />
              </button>
            </div>

            <nav aria-label={`Secciones de ${role}`} className="flex-1 px-3 py-4">
              <ul className="space-y-1">
                {items.map(({ label, href, icon }) => {
                  const Icon = navigationIcons[icon]
                  const isActive = isNavigationItemActive(pathname, href)
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          'flex min-h-12 items-center gap-3 rounded-xl px-3.5 py-2.5 text-[0.95rem] font-bold',
                          'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lysto-blue',
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 active:bg-slate-200'
                        )}
                      >
                        <Icon aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2} />
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        <ChevronRight aria-hidden="true" className={cn('h-4 w-4 shrink-0', isActive ? 'text-blue-500' : 'text-slate-400')} />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            <div className="border-t border-slate-200 px-5 pt-4">
              <p className="text-xs font-semibold leading-5 text-slate-500">
                Navegación segura para tu operación Lysto.
              </p>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
