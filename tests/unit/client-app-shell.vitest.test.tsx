import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ClientBottomNavigation } from '@/components/app-shell/client-bottom-navigation'

import {
  clientNavigationItems,
  isClientNavigationItemActive,
  shouldShowClientBottomNavigation
} from '@/components/app-shell/client-navigation'

const navigation = vi.hoisted(() => ({ pathname: '/app/equipos' }))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname
}))

afterEach(() => cleanup())

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

describe('client bottom navigation', () => {
  it('renders five destinations and marks Equipos active', () => {
    render(<ClientBottomNavigation />)
    const nav = screen.getByRole('navigation', { name: 'Navegación principal del cliente' })

    expect(within(nav).getAllByRole('link')).toHaveLength(5)
    expect(within(nav).getByRole('link', { name: 'Equipos' }).getAttribute('aria-current')).toBe('page')
    expect(within(nav).getByRole('link', { name: 'Inicio' }).hasAttribute('aria-current')).toBe(false)
  })

  it('keeps Pedir visually and semantically distinct', () => {
    render(<ClientBottomNavigation />)
    const request = screen.getByRole('link', { name: 'Pedir un servicio' })

    expect(request.getAttribute('href')).toBe('/app/solicitar/aire-acondicionado')
    expect(request.getAttribute('data-primary')).toBe('true')
  })
})
