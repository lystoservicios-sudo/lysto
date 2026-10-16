import fs from 'node:fs'
import path from 'node:path'
import type { ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  pathname: '/pro/dashboard',
  guard: vi.fn(),
  identity: vi.fn()
}))

vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }))
vi.mock('@/lib/auth/session', () => ({ requireProfessionalWorkspaceSession: mocks.guard }))
vi.mock('@/lib/auth/account-identity', () => ({ readAccountIdentity: mocks.identity }))
vi.mock('@/components/layout/page-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <>
    <header>Encabezado general</header>
    <aside aria-label="Navegación profesional general">Menú general</aside>
    <main id="main-content">{children}</main>
  </>
}))
vi.mock('@/components/pro/pro-ui', () => ({
  ProWorkspace: ({ children, pending }: { children: ReactNode; pending: boolean }) => <>
    {children}
    <nav aria-label="Navegación profesional anterior" data-pending={String(pending)} />
  </>
}))

import ProfessionalLayout from '@/app/(professional)/pro/layout'

const id = '10000000-0000-4000-8000-000000000001'
const session = { professionalStatus: 'approved', professionalEligible: true }

beforeEach(() => {
  mocks.pathname = '/pro/dashboard'
  mocks.guard.mockResolvedValue(session)
  mocks.identity.mockResolvedValue({ name: 'Profesional', email: 'pro@example.com' })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('professional compact detail navigation', () => {
  it.each([`/pro/trabajos/${id}`, `/pro/solicitudes/${id}`])(
    'opens %s without duplicated general chrome or navigation', async (pathname) => {
      mocks.pathname = pathname
      render(await ProfessionalLayout({ children: <p>Expediente del servicio</p> }))

      expect(screen.queryByText('Encabezado general')).toBeNull()
      expect(screen.queryByRole('complementary')).toBeNull()
      expect(screen.queryByRole('navigation')).toBeNull()
      expect(screen.getAllByRole('main')).toHaveLength(1)
      expect(screen.getByRole('main').textContent).toContain('Expediente del servicio')
      expect(screen.getByRole('main').id).toBe('main-content')
      expect(screen.getByRole('main').getAttribute('tabindex')).toBe('-1')
      expect(screen.getByRole('link', { name: 'Saltar al contenido' }).getAttribute('href'))
        .toBe('#main-content')
    }
  )

  it.each([
    '/pro/dashboard', '/pro/trabajos', '/pro/solicitudes', '/pro/perfil',
    '/pro/agenda', '/pro/pagos', '/pro/mas', '/pro/onboarding/documentos',
    '/app/trabajos/' + id, '/admin/trabajos/' + id,
    '/pro/trabajos/no-es-un-uuid', `/pro/trabajos/${id}/otra-pantalla`
  ])('preserves the standard professional shell on %s', async (pathname) => {
    mocks.pathname = pathname
    render(await ProfessionalLayout({ children: <p>Contenido existente</p> }))

    expect(screen.getByText('Encabezado general')).toBeTruthy()
    expect(screen.getByRole('complementary', { name: 'Navegación profesional general' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Navegación profesional anterior' })).toBeTruthy()
    expect(screen.getByRole('main').textContent).toContain('Contenido existente')
    expect(screen.getAllByText('Contenido existente')).toHaveLength(1)
  })

  it('keeps the server session guard before identity or protected content', async () => {
    mocks.pathname = `/pro/trabajos/${id}`
    mocks.guard.mockRejectedValue(new Error('professional-session-required'))

    await expect(ProfessionalLayout({ children: <p>Privado</p> }))
      .rejects.toThrow('professional-session-required')
    expect(mocks.guard).toHaveBeenCalledOnce()
    expect(mocks.identity).not.toHaveBeenCalled()
  })

  it('retains the pending-workspace state outside the compact detail', async () => {
    mocks.guard.mockResolvedValue({ professionalStatus: 'pending_review', professionalEligible: false })
    render(await ProfessionalLayout({ children: <p>Alta profesional</p> }))
    expect(screen.getByRole('navigation').getAttribute('data-pending')).toBe('true')
  })

  it('connects Más to existing protected functions without inventing new settings', () => {
    const file = path.join(process.cwd(), 'app/(professional)/pro/mas/page.tsx')
    const source = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
    expect(source).toContain("requirePageSession('professional')")
    for (const href of [
      '/pro/perfil', '/pro/pagos/mercadopago', '/pro/seguridad',
      '/pro/soporte', '/pro/capacitacion', '/pro/solicitudes', '/pro/presupuestos'
    ]) expect(source).toContain(href)
  })
})
