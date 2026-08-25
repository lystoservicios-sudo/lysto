export const appNavigation = {
  Cliente: [
    { label: 'Panel', href: '/app', icon: 'home' },
    { label: 'Solicitar', href: '/app/solicitar/aire-acondicionado', icon: 'plus' },
    { label: 'Trabajos', href: '/app/trabajos', icon: 'work' },
    { label: 'Equipos', href: '/app/equipos', icon: 'equipment' },
    { label: 'Mantenimientos', href: '/app/mantenimientos', icon: 'calendar' },
    { label: 'Garantías', href: '/app/garantias', icon: 'quality' },
    { label: 'Pagos', href: '/app/pagos', icon: 'payments' }
  ],
  Profesional: [
    { label: 'Panel', href: '/pro/dashboard', icon: 'dashboard' },
    { label: 'Solicitudes', href: '/pro/solicitudes', icon: 'requests' },
    { label: 'Trabajos', href: '/pro/trabajos', icon: 'work' },
    { label: 'Agenda', href: '/pro/agenda', icon: 'calendar' },
    { label: 'Capacitación', href: '/pro/capacitacion', icon: 'training' },
    { label: 'Soporte', href: '/pro/soporte', icon: 'support' },
    { label: 'Pagos', href: '/pro/pagos', icon: 'payments' }
  ],
  Admin: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: 'dashboard' },
    { label: 'Solicitudes', href: '/admin/solicitudes', icon: 'requests' },
    { label: 'Trabajos', href: '/admin/trabajos', icon: 'work' },
    { label: 'Profesionales', href: '/admin/profesionales', icon: 'professionals' },
    { label: 'Pagos', href: '/admin/pagos', icon: 'payments' },
    { label: 'Matching', href: '/admin/matching', icon: 'matching' },
    { label: 'Calidad', href: '/admin/calidad', icon: 'quality' },
    { label: 'Reportes', href: '/admin/reportes', icon: 'reports' }
  ]
} as const

export type AppRole = keyof typeof appNavigation
export type AppNavigationIcon = typeof appNavigation[AppRole][number]['icon']

export const appRoleLabels: Record<AppRole, string> = {
  Admin: 'Administración',
  Cliente: 'Espacio cliente',
  Profesional: 'Espacio profesional'
}

export function isNavigationItemActive(pathname: string, href: string) {
  return pathname === href || (href !== '/app' && pathname.startsWith(`${href}/`))
}
