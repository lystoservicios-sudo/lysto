import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppShellProvider } from '@/components/layout/app-shell-provider'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppTopbar } from '@/components/layout/app-topbar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/trabajos'
}))

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  window.dispatchEvent(new Event('resize'))
}

function renderShell(defaultOpen = true, adminPermissions?: readonly string[]) {
  return render(
    <AppShellProvider defaultOpen={defaultOpen}>
      <AppSidebar role="Admin" adminPermissions={adminPermissions} />
      <AppTopbar role="Admin" />
    </AppShellProvider>
  )
}

beforeEach(() => {
  setViewport(1280)
  document.body.style.overflow = ''
})

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

describe('authenticated app navigation', () => {
  it('uses the current role navigation and marks the active route', () => {
    renderShell()

    const sidebar = screen.getByRole('complementary', { name: 'Navegación de Administración' })
    const activeLink = within(sidebar).getByRole('link', { name: 'Trabajos' })

    expect(activeLink.getAttribute('aria-current')).toBe('page')
    expect(activeLink.getAttribute('data-active')).toBe('true')
    expect(within(sidebar).queryByText('Productos')).toBeNull()
    expect(within(sidebar).queryByText('Pedidos')).toBeNull()
    expect(within(sidebar).queryByText('Ver tienda')).toBeNull()
  })

  it('hides admin destinations outside the active operator permissions', () => {
    renderShell(true, ['operations'])

    const sidebar = screen.getByRole('complementary', { name: 'Navegación de Administración' })
    expect(within(sidebar).getByRole('link', { name: 'Solicitudes' })).toBeTruthy()
    expect(within(sidebar).queryByRole('link', { name: 'Pagos' })).toBeNull()
    expect(within(sidebar).queryByRole('link', { name: 'Calidad' })).toBeNull()
  })

  it('collapses and expands the desktop sidebar from the topbar', () => {
    renderShell()

    const sidebar = screen.getByRole('complementary', { name: 'Navegación de Administración' })
    const trigger = screen.getByRole('button', { name: 'Contraer navegación' })

    expect(sidebar.getAttribute('data-state')).toBe('expanded')
    fireEvent.click(trigger)
    expect(sidebar.getAttribute('data-state')).toBe('collapsed')
    expect(screen.getByRole('button', { name: 'Expandir navegación' })).toBeTruthy()
  })

  it('opens an accessible mobile drawer at document level', async () => {
    setViewport(390)
    renderShell()

    const trigger = screen.getByRole('button', { name: 'Abrir navegación' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)

    const drawer = screen.getByRole('dialog', { name: 'Navegación principal' })
    expect(drawer.parentElement?.parentElement).toBe(document.body)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.body.style.overflow).toBe('hidden')
    await waitFor(() => expect(document.activeElement).toBe(within(drawer).getByRole('button', { name: 'Cerrar navegación' })))
  })

  it('traps focus inside the mobile drawer', async () => {
    setViewport(390)
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir navegación' }))

    const drawer = screen.getByRole('dialog', { name: 'Navegación principal' })
    const close = within(drawer).getByRole('button', { name: 'Cerrar navegación' })
    const links = within(drawer).getAllByRole('link')
    const lastLink = links.at(-1) as HTMLAnchorElement

    await waitFor(() => expect(document.activeElement).toBe(close))
    lastLink.focus()
    fireEvent.keyDown(drawer, { key: 'Tab' })
    expect(document.activeElement).toBe(close)

    close.focus()
    fireEvent.keyDown(drawer, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(lastLink)
  })

  it('closes the mobile drawer with Escape and restores focus', async () => {
    setViewport(390)
    renderShell()
    const trigger = screen.getByRole('button', { name: 'Abrir navegación' })

    fireEvent.click(trigger)
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Navegación principal' })).toBeTruthy())
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Navegación principal' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(document.body.style.overflow).toBe('')
  })

  it('closes from the backdrop or after choosing a destination', () => {
    setViewport(390)
    renderShell()
    const trigger = screen.getByRole('button', { name: 'Abrir navegación' })

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar navegación al tocar fuera' }))
    expect(screen.queryByRole('dialog', { name: 'Navegación principal' })).toBeNull()

    fireEvent.click(trigger)
    const drawer = screen.getByRole('dialog', { name: 'Navegación principal' })
    const destination = within(drawer).getByRole('link', { name: 'Solicitudes' })
    destination.addEventListener('click', (event) => event.preventDefault(), { once: true })
    fireEvent.click(destination)
    expect(screen.queryByRole('dialog', { name: 'Navegación principal' })).toBeNull()
  })
})
