import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  adminModules,
  calculateSplit,
  canAccessAdminModule,
  matchesSearch
} from '@/components/admin/admin-model'
import { AdminWorkspace } from '@/components/admin/admin-ui'
import { CatalogConsole, OperationsDashboard } from '@/components/admin/live-operations'

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/dashboard' }))
afterEach(cleanup)

const queue = {
  total: 3,
  items: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      entityType: 'request' as const,
      createdAt: '2026-09-12T12:00:00.000Z',
      status: 'pending_assignment',
      priority: 'high',
      assignedTo: null,
      nextAction: 'Asignar profesional',
      dueAt: '2020-01-01T00:00:00.000Z'
    }
  ]
}

describe('administrative UI', () => {
  it('has no production dependency on demo fixtures', () => {
    const files = [
      'components/admin/admin-details.tsx',
      'components/admin/admin-lists.tsx',
      'components/admin/admin-settings.tsx',
      'components/admin/live-operations.tsx'
    ]
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), 'utf8')
      expect(source).not.toContain('@/lib/mock')
      expect(source.toLowerCase()).not.toContain('datos demo')
    }
  })

  it('searches without requiring accents or capitalization', () => {
    expect(matchesSearch('LUCIA', ['Lucía Fernández'])).toBe(true)
    expect(matchesSearch('Belgrano', ['Palermo'])).toBe(false)
  })

  it('keeps every non-detail module discoverable', () => {
    expect(
      new Set(adminModules.flatMap((group) => group.items.map(([, route]) => route))).size
    ).toBe(21)
  })

  it('separates modules by operator permission', () => {
    expect(canAccessAdminModule('solicitudes', ['operations'])).toBe(true)
    expect(canAccessAdminModule('pagos', ['operations'])).toBe(false)
    expect(canAccessAdminModule('pagos', ['finance'])).toBe(true)
    expect(canAccessAdminModule('reclamos', ['finance'])).toBe(false)
    expect(canAccessAdminModule('configuracion', ['owner'])).toBe(true)
  })

  it('only exposes permitted tools in the workspace', () => {
    render(
      <AdminWorkspace permissions={['operations']}>
        <p>Contenido</p>
      </AdminWorkspace>
    )
    fireEvent.click(screen.getByRole('button', { name: /Todas las herramientas/ }))
    expect(screen.getByRole('link', { name: 'Solicitudes' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Pagos' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Configuración' })).toBeNull()
  })

  it('renders real queue fields and pagination', () => {
    render(<OperationsDashboard queue={queue} nextHref="/admin/dashboard?cursor=next" />)
    expect(screen.getByText('Asignar profesional')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('Ver siguientes registros').getAttribute('href')).toContain(
      'cursor=next'
    )
    expect(screen.queryByText(/demo/i)).toBeNull()
  })

  it('renders a safe empty catalog state', () => {
    render(<CatalogConsole title="Servicios" rows={[]} />)
    expect(screen.getByText('No hay elementos configurados.')).toBeTruthy()
  })

  it('calculates the split and clamps invalid commissions', () => {
    expect(calculateSplit(35000, 18)).toEqual({ fee: 6300, professional: 28700 })
    expect(calculateSplit(100, 150)).toEqual({ fee: 100, professional: 0 })
    expect(calculateSplit(-20, 18)).toEqual({ fee: 0, professional: 0 })
  })
})
