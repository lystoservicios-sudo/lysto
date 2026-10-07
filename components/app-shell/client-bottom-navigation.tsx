'use client'

import { usePathname } from 'next/navigation'

import { isClientNavigationItemActive, clientNavigationItems } from './client-navigation'
import { ClientNavItem } from './client-nav-item'

export function ClientBottomNavigation() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegación principal del cliente"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 px-2 pt-2 backdrop-blur"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto grid max-w-xl grid-cols-5 items-end gap-1">
        {clientNavigationItems.map((item) => (
          <ClientNavItem
            key={item.id}
            {...item}
            active={isClientNavigationItemActive(pathname, item.href)}
          />
        ))}
      </div>
    </nav>
  )
}
