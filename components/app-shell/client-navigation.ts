export const clientNavigationItems = [
  { id: 'home', label: 'Inicio', href: '/app', icon: 'grid', activePaths: ['/app'], exact: true },
  {
    id: 'services', label: 'Servicios', href: '/app/trabajos', icon: 'services',
    activePaths: ['/app/trabajos', '/app/solicitudes', '/app/presupuestos']
  },
  {
    id: 'request', label: 'Pedir', href: '/app/solicitar/aire-acondicionado', icon: 'plus',
    activePaths: ['/app/solicitar'], primary: true
  },
  {
    id: 'household', label: 'Hogar', href: '/app/hogar', icon: 'home',
    activePaths: ['/app/hogar', '/app/equipos']
  },
  {
    id: 'more', label: 'Más', href: '/app/mas', icon: 'more',
    activePaths: ['/app/mas', '/app/perfil', '/app/pagos', '/app/garantias', '/app/direcciones', '/app/mantenimientos']
  }
] as const

export type ClientNavigationItem = (typeof clientNavigationItems)[number]

const focusedFlowPrefixes = ['/app/solicitar/'] as const

export function isClientNavigationItemActive(pathname: string, item: ClientNavigationItem) {
  if ('exact' in item && item.exact) return pathname === item.href

  return item.activePaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

export function shouldShowClientBottomNavigation(pathname: string) {
  return !focusedFlowPrefixes.some((prefix) => pathname.startsWith(prefix))
}
