import Link from 'next/link'
import type { ReactNode } from 'react'
import { MarketingHeader } from './marketing-header'
import { cn } from '@/lib/utils/cn'

const roleNav = {
  Cliente: [
    ['Panel', '/app'],
    ['Solicitar', '/app/solicitar/aire-acondicionado'],
    ['Trabajos', '/app/trabajos'],
    ['Equipos', '/app/equipos'],
    ['Mantenimientos', '/app/mantenimientos'],
    ['Garantías', '/app/garantias'],
    ['Pagos', '/app/pagos']
  ],
  Profesional: [
    ['Panel', '/pro/dashboard'],
    ['Solicitudes', '/pro/solicitudes'],
    ['Trabajos', '/pro/trabajos'],
    ['Agenda', '/pro/agenda'],
    ['Capacitación', '/pro/capacitacion'],
    ['Soporte', '/pro/soporte'],
    ['Pagos', '/pro/pagos']
  ],
  Admin: [
    ['Dashboard', '/admin/dashboard'],
    ['Solicitudes', '/admin/solicitudes'],
    ['Trabajos', '/admin/trabajos'],
    ['Profesionales', '/admin/profesionales'],
    ['Pagos', '/admin/pagos'],
    ['Matching', '/admin/matching'],
    ['Calidad', '/admin/calidad'],
    ['Reportes', '/admin/reportes']
  ]
} as const

export function PublicShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen lysto-gradient"><MarketingHeader />{children}</div>
}

export function AppShell({ children, role }: { children: ReactNode; role: keyof typeof roleNav }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-black"><span className="grid h-9 w-9 place-items-center rounded-2xl bg-lysto-blue text-white">L</span>Lysto</Link>
          <nav className="hidden items-center gap-1 overflow-x-auto lg:flex">
            {roleNav[role].map(([label, href]) => <Link key={href} href={href} className={cn('rounded-full px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-950')}>{label}</Link>)}
          </nav>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{role}</span>
        </div>
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 lg:hidden">
          {roleNav[role].map(([label, href]) => <Link key={href} href={href} className="shrink-0 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">{label}</Link>)}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
