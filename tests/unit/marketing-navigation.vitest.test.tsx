import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarketingHeader } from '@/components/layout/marketing-header'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
afterEach(cleanup)

describe('public website navigation', () => {
  it('offers the four public pages and account access', () => {
    render(<MarketingHeader />)
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    for (const [name, href] of [['Inicio', '/'], ['Solución', '/solucion'], ['Nosotros', '/nosotros'], ['Contacto', '/contacto']]) {
      expect(within(nav).getByRole('link', { name }).getAttribute('href')).toBe(href)
    }
    expect(screen.getByRole('link', { name: 'Iniciar sesión' }).getAttribute('href')).toBe('/login')
  })

  it('opens the mobile navigation and closes on Escape, returning focus', () => {
    render(<MarketingHeader />)
    const toggle = screen.getByRole('button', { name: 'Abrir menú' })
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('navigation', { name: 'Navegación móvil' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle)
    expect(screen.queryByRole('navigation', { name: 'Navegación móvil' })).toBeNull()
  })

  it('closes the mobile navigation when a destination is selected', () => {
    render(<MarketingHeader />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
    const link = within(screen.getByRole('navigation', { name: 'Navegación móvil' })).getByRole('link', { name: 'Solución' })
    link.addEventListener('click', event => event.preventDefault())
    fireEvent.click(link)
    expect(screen.queryByRole('navigation', { name: 'Navegación móvil' })).toBeNull()
  })
})
