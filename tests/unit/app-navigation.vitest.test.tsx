import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppNavigation } from '@/components/layout/app-navigation'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/trabajos'
}))

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

describe('authenticated app navigation', () => {
  it('opens a complete role-aware mobile sidebar and marks the current route', () => {
    render(<AppNavigation role="Admin" />)

    const trigger = screen.getByRole('button', { name: 'Abrir menú' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('dialog', { name: 'Menú principal' })).toBeNull()

    fireEvent.click(trigger)

    const sidebar = screen.getByRole('dialog', { name: 'Menú principal' })
    const links = within(sidebar).getAllByRole('link')
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Dashboard',
      'Solicitudes',
      'Trabajos',
      'Profesionales',
      'Pagos',
      'Matching',
      'Calidad',
      'Reportes'
    ])
    expect(within(sidebar).getByRole('link', { name: 'Trabajos' }).getAttribute('aria-current'))
      .toBe('page')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('closes from its close control and restores focus to the trigger', () => {
    render(<AppNavigation role="Admin" />)
    const trigger = screen.getByRole('button', { name: 'Abrir menú' }) as HTMLButtonElement

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar menú' }))

    expect(screen.queryByRole('dialog', { name: 'Menú principal' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(document.body.style.overflow).toBe('')
  })

  it('closes when the user presses Escape', () => {
    render(<AppNavigation role="Admin" />)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Menú principal' })).toBeNull()
  })
})
