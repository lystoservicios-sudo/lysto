export const clientNavigationItems = [
  { id: 'home', label: 'Inicio', href: '/app', icon: 'grid' },
  { id: 'household', label: 'Hogar', href: '/app/hogar', icon: 'home' },
  { id: 'request', label: 'Pedir', href: '/app/solicitar/aire-acondicionado', icon: 'plus', primary: true },
  { id: 'equipment', label: 'Equipos', href: '/app/equipos', icon: 'equipment' },
  { id: 'account', label: 'Cuenta', href: '/app/perfil', icon: 'account' }
] as const

const focusedFlowPrefixes = ['/app/solicitar/'] as const

export function isClientNavigationItemActive(pathname: string, href: string) {
  return pathname === href || (href !== '/app' && pathname.startsWith(`${href}/`))
}

export function shouldShowClientBottomNavigation(pathname: string) {
  return !focusedFlowPrefixes.some((prefix) => pathname.startsWith(prefix))
}
