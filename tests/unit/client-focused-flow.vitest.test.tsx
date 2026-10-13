import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClientAppShell } from '@/components/app-shell/client-app-shell'
import { useClientFocusedFlow } from '@/components/app-shell/client-flow-context'
import { StrictMode } from 'react'

vi.mock('next/navigation', () => ({ usePathname: () => '/app/trabajos' }))

afterEach(cleanup)

function Flow({ active }: { active: boolean }) {
  useClientFocusedFlow(active)
  return active ? <p>Decisión enfocada</p> : null
}

const nav = () => screen.queryByRole('navigation', { name: 'Navegación principal del cliente' })

describe('temporary focused customer flows', () => {
  it('allows legacy embeds without a customer shell provider', () => {
    render(<Flow active />)
    expect(screen.getByText('Decisión enfocada')).toBeTruthy()
  })

  it('balances registration under StrictMode effect replay', () => {
    const { rerender } = render(<StrictMode><ClientAppShell><Flow active /></ClientAppShell></StrictMode>)
    expect(nav()).toBeNull()
    rerender(<StrictMode><ClientAppShell><Flow active={false} /></ClientAppShell></StrictMode>)
    expect(nav()).not.toBeNull()
  })

  it('keeps navigation visible outside a focused flow', () => {
    render(<ClientAppShell><Flow active={false} /></ClientAppShell>)
    expect(nav()).not.toBeNull()
  })

  it('hides navigation and restores it when the flow closes', () => {
    const { rerender } = render(<ClientAppShell><Flow active /></ClientAppShell>)
    expect(nav()).toBeNull()
    rerender(<ClientAppShell><Flow active={false} /></ClientAppShell>)
    expect(nav()).not.toBeNull()
  })

  it('does not release navigation while another focused flow remains open', () => {
    const { rerender } = render(
      <ClientAppShell><Flow active /><Flow active /></ClientAppShell>
    )
    expect(nav()).toBeNull()
    rerender(<ClientAppShell><Flow active={false} /><Flow active /></ClientAppShell>)
    expect(nav()).toBeNull()
    rerender(<ClientAppShell><Flow active={false} /><Flow active={false} /></ClientAppShell>)
    expect(nav()).not.toBeNull()
  })

  it('restores navigation when the focused component unmounts', () => {
    const { rerender } = render(<ClientAppShell><Flow active /></ClientAppShell>)
    expect(nav()).toBeNull()
    rerender(<ClientAppShell><p>Detalle del servicio</p></ClientAppShell>)
    expect(nav()).not.toBeNull()
  })
})
