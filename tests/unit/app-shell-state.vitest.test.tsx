import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AppShellProvider, useAppShell } from '@/components/layout/app-shell-provider'

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  window.dispatchEvent(new Event('resize'))
}

function StateHarness() {
  const { desktopOpen, mobileOpen, setMobileOpen, toggleSidebar } = useAppShell()

  return (
    <div data-app-shell-content>
      <output aria-label="desktop state">{desktopOpen ? 'open' : 'closed'}</output>
      <output aria-label="mobile state">{mobileOpen ? 'open' : 'closed'}</output>
      <button type="button" onClick={toggleSidebar}>Alternar</button>
      <button type="button" onClick={() => setMobileOpen(false)}>Cerrar mobile</button>
    </div>
  )
}

function renderState(defaultOpen = true) {
  return render(
    <AppShellProvider defaultOpen={defaultOpen}>
      <StateHarness />
    </AppShellProvider>
  )
}

beforeEach(() => {
  setViewport(1280)
  document.cookie = 'sidebar_state=; path=/; max-age=0'
  document.body.style.overflow = ''
})

afterEach(() => {
  cleanup()
  document.cookie = 'sidebar_state=; path=/; max-age=0'
  document.body.style.overflow = ''
})

describe('app shell state', () => {
  it('persists desktop collapse state in a cookie', () => {
    renderState()
    fireEvent.click(screen.getByRole('button', { name: 'Alternar' }))

    expect(screen.getByLabelText('desktop state').textContent).toBe('closed')
    expect(document.cookie).toContain('sidebar_state=false')
  })

  it('supports the Control+B keyboard shortcut', () => {
    renderState(false)
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true })

    expect(screen.getByLabelText('desktop state').textContent).toBe('open')
    expect(document.cookie).toContain('sidebar_state=true')
  })

  it('uses the same toggle to open navigation on mobile', () => {
    setViewport(390)
    renderState()
    fireEvent.click(screen.getByRole('button', { name: 'Alternar' }))

    expect(screen.getByLabelText('mobile state').textContent).toBe('open')
    expect(screen.getByLabelText('desktop state').textContent).toBe('open')
  })

  it('restores the previous body overflow value after mobile closes', () => {
    setViewport(390)
    document.body.style.overflow = 'clip'
    renderState()

    fireEvent.click(screen.getByRole('button', { name: 'Alternar' }))
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar mobile' }))
    expect(document.body.style.overflow).toBe('clip')
  })

  it('makes background content inert while mobile navigation is open', () => {
    setViewport(390)
    renderState()
    const content = document.querySelector('[data-app-shell-content]')

    fireEvent.click(screen.getByRole('button', { name: 'Alternar' }))
    expect(content?.hasAttribute('inert')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar mobile' }))
    expect(content?.hasAttribute('inert')).toBe(false)
  })
})
