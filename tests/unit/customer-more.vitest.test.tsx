import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CustomerMore } from '@/components/customer/more/customer-more'

const profile = { firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com' }
afterEach(cleanup)
describe('customer More hub', () => {
  it('connects all approved sections without duplicating Home or Services', () => {
    render(<CustomerMore profile={profile} pendingPayments={0} awaitingReplies={0} />)
    for (const href of ['/app/perfil', '/app/pagos', '/app/garantias', '/app/ayuda', '/app/preferencias', '/app/seguridad'])
      expect(document.querySelector(`a[href="${href}"]`)).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Más')
    expect(screen.queryByText(/Hola|Bienvenida/)).toBeNull()
    expect(document.querySelector('a[href="/app/equipos"]')).toBeNull()
    expect(document.querySelector('form')?.getAttribute('action')).toBe('/auth/logout')
  })
  it('shows only actual pending actions with correct singular copy', () => {
    render(<CustomerMore profile={profile} pendingPayments={1} awaitingReplies={2} />)
    expect(screen.getByText('1 pago para completar')).toBeTruthy()
    expect(screen.getByText('2 consultas esperan tu respuesta')).toBeTruthy()
  })
  it('does not transform failed reads into a reassuring zero', () => {
    render(<CustomerMore profile={profile} pendingPayments={null} awaitingReplies={0} />)
    expect(screen.getByRole('status').textContent).toContain('No pudimos actualizar todos los avisos')
    expect(screen.queryByText(/No tenés pendientes/)).toBeNull()
  })
})
