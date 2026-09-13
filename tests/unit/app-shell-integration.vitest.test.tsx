import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppShell } from '@/components/layout/page-shell'

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => name === 'sidebar_state' ? { value: 'false' } : undefined
  })
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/dashboard'
}))

afterEach(() => cleanup())

describe('app shell integration', () => {
  it('shows verified identity and submits logout as a mutation', async () => {
    render(await AppShell({ role:'Admin', identity:{name:'Operadora Real',email:'operator@lysto.test'},children:<p>Cuenta</p> }))
    expect(screen.getByText('Operadora Real').getAttribute('title')).toBe('operator@lysto.test')
    const form = screen.getByRole('button',{name:'Cerrar sesión'}).closest('form')
    expect(form?.getAttribute('method')).toBe('post')
    expect(form?.getAttribute('action')).toBe('/auth/logout')
  })
  it('composes the shared shell and respects the persisted desktop state', async () => {
    render(await AppShell({ role: 'Admin', children: <p>Contenido operativo</p> }))

    const sidebar = screen.getByRole('complementary', { name: 'Navegación de Administración' })
    expect(sidebar.getAttribute('data-state')).toBe('collapsed')
    expect(screen.getByRole('button', { name: 'Expandir navegación' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Saltar al contenido' }).getAttribute('href')).toBe('#main-content')
    const main = screen.getByRole('main')
    expect(main.id).toBe('main-content')
    expect(main.getAttribute('tabindex')).toBe('-1')
    expect(screen.getByText('Contenido operativo')).toBeTruthy()
  })
})
