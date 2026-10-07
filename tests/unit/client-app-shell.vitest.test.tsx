import { describe, expect, it } from 'vitest'

import {
  clientNavigationItems,
  isClientNavigationItemActive,
  shouldShowClientBottomNavigation
} from '@/components/app-shell/client-navigation'

describe('client app shell navigation policy', () => {
  it('defines the five approved customer destinations in order', () => {
    expect(clientNavigationItems.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: 'Inicio', href: '/app' },
      { label: 'Hogar', href: '/app/hogar' },
      { label: 'Pedir', href: '/app/solicitar/aire-acondicionado' },
      { label: 'Equipos', href: '/app/equipos' },
      { label: 'Cuenta', href: '/app/perfil' }
    ])
  })

  it('keeps nested equipment pages inside Equipos without marking Inicio active', () => {
    expect(isClientNavigationItemActive('/app/equipos/abc', '/app/equipos')).toBe(true)
    expect(isClientNavigationItemActive('/app/equipos/abc', '/app')).toBe(false)
  })

  it('hides bottom navigation in the focused request flow', () => {
    expect(shouldShowClientBottomNavigation('/app')).toBe(true)
    expect(shouldShowClientBottomNavigation('/app/equipos')).toBe(true)
    expect(shouldShowClientBottomNavigation('/app/solicitar/aire-acondicionado')).toBe(false)
  })
})
