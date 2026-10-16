'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

const compactDetailPath = /^\/pro\/(?:trabajos|solicitudes)\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\/?$/

export function ProfessionalRouteShell({
  children,
  standard
}: {
  children: ReactNode
  standard: ReactNode
}) {
  const pathname = usePathname()
  if (!compactDetailPath.test(pathname ?? '')) return standard

  return (
    <div className="min-h-svh min-w-0 bg-white">
      <a
        href="#main-content"
        className="lysto-skip-link fixed left-4 top-4 z-[60] -translate-y-24 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-transform duration-150 focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
      >
        Saltar al contenido
      </a>
      <main id="main-content" tabIndex={-1} className="min-w-0">
        {children}
      </main>
    </div>
  )
}
